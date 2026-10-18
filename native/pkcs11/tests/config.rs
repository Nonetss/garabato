use std::{fs, os::unix::fs::PermissionsExt};

use std::path::PathBuf;

use garabato_pkcs11::config::{
    Config, ConfigError, Os, config_dir_for, load, parse, state_dir_for,
};

fn env(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
    let pairs: Vec<(String, String)> = pairs
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
    move |name| {
        pairs
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.clone())
    }
}

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
    assert_eq!(
        config,
        Config {
            url: "https://garabato.lan".into(),
            key: "gbt_123".into()
        }
    );
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
    let path = temp_file(
        "private",
        r#"{ "url": "http://127.0.0.1:4321", "key": "k" }"#,
        0o600,
    );
    assert_eq!(load(&path).unwrap().url, "http://127.0.0.1:4321");
}

#[test]
fn refuses_a_file_others_can_read() {
    let path = temp_file(
        "exposed",
        r#"{ "url": "http://127.0.0.1:4321", "key": "k" }"#,
        0o644,
    );
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

#[test]
fn windows_directories_follow_appdata() {
    let var = env(&[
        ("APPDATA", r"C:\Users\ana\AppData\Roaming"),
        ("LOCALAPPDATA", r"C:\Users\ana\AppData\Local"),
    ]);
    assert_eq!(
        config_dir_for(Os::Windows, &var),
        PathBuf::from(r"C:\Users\ana\AppData\Roaming").join("Garabato")
    );
    assert_eq!(
        state_dir_for(Os::Windows, &var),
        PathBuf::from(r"C:\Users\ana\AppData\Local").join("Garabato")
    );
}

#[test]
fn windows_directories_fall_back_to_the_profile() {
    let var = env(&[("USERPROFILE", r"C:\Users\ana")]);
    assert_eq!(
        config_dir_for(Os::Windows, &var),
        PathBuf::from(r"C:\Users\ana")
            .join("AppData")
            .join("Roaming")
            .join("Garabato")
    );
}

#[test]
fn unix_directories_follow_xdg_then_home() {
    let xdg = env(&[
        ("XDG_CONFIG_HOME", "/cfg"),
        ("XDG_STATE_HOME", "/state"),
        ("HOME", "/home/ana"),
    ]);
    assert_eq!(
        config_dir_for(Os::Unix, &xdg),
        PathBuf::from("/cfg/garabato")
    );
    assert_eq!(
        state_dir_for(Os::Unix, &xdg),
        PathBuf::from("/state/garabato")
    );

    let home = env(&[("HOME", "/home/ana")]);
    assert_eq!(
        config_dir_for(Os::Unix, &home),
        PathBuf::from("/home/ana/.config/garabato")
    );
    assert_eq!(
        state_dir_for(Os::Unix, &home),
        PathBuf::from("/home/ana/.local/state/garabato")
    );
}
