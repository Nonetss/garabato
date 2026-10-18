use std::{fs, os::unix::fs::PermissionsExt};

use garabato_pkcs11::config::{Config, ConfigError, load, parse};

fn temp_file(name: &str, text: &str, mode: u32) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("garabato-pkcs11-{}-{name}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("token.json");
    fs::write(&path, text).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(mode)).unwrap();
    path
}

#[test]
fn parses_and_trims_the_address() {
    let config = parse(r#"{ "url": "https://garabato.lan/ ", "key": " gbt_123 " }"#).unwrap();
    assert_eq!(config, Config { url: "https://garabato.lan".into(), key: "gbt_123".into() });
}

#[test]
fn rejects_an_address_without_scheme() {
    assert!(matches!(
        parse(r#"{ "url": "garabato.lan", "key": "k" }"#),
        Err(ConfigError::Invalid(_))
    ));
}

#[test]
fn rejects_an_empty_key() {
    assert!(matches!(
        parse(r#"{ "url": "https://garabato.lan", "key": "" }"#),
        Err(ConfigError::Invalid(_))
    ));
}

#[test]
fn loads_an_owner_only_file() {
    let path = temp_file("private", r#"{ "url": "http://127.0.0.1:4321", "key": "k" }"#, 0o600);
    assert_eq!(load(&path).unwrap().url, "http://127.0.0.1:4321");
}

#[test]
fn refuses_a_file_others_can_read() {
    let path = temp_file("exposed", r#"{ "url": "http://127.0.0.1:4321", "key": "k" }"#, 0o644);
    assert_eq!(load(&path), Err(ConfigError::Exposed(path.clone())));
}

#[test]
fn reports_a_missing_file() {
    let path = std::env::temp_dir().join("garabato-pkcs11-none/token.json");
    assert_eq!(load(&path), Err(ConfigError::Missing(path.clone())));
}

#[test]
fn never_prints_the_key() {
    let error = parse(r#"{ "url": "ftp://x", "key": "gbt_secret" }"#).unwrap_err();
    assert!(!error.to_string().contains("gbt_secret"));
}
