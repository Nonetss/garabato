//! Where the module finds Garabato: a JSON file with the Garabato address and
//! the token key, in the user's configuration directory, readable by them
//! alone.

use std::{
    fmt, fs,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Config {
    /// Public origin of Garabato, e.g. `https://garabato.lan`.
    pub url: String,
    /// The token key created from "Conectar navegador".
    pub key: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    Missing(PathBuf),
    Exposed(PathBuf),
    Unreadable(String),
    Invalid(String),
}

// Never prints the key: these messages go to the log.
impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::Missing(path) => write!(f, "no configuration at {}", path.display()),
            ConfigError::Exposed(path) => write!(
                f,
                "{} can be read by other users; run chmod 600 on it",
                path.display()
            ),
            ConfigError::Unreadable(reason) => write!(f, "cannot read the configuration: {reason}"),
            ConfigError::Invalid(reason) => write!(f, "invalid configuration: {reason}"),
        }
    }
}

fn home() -> PathBuf {
    std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("/tmp"))
}

fn xdg_dir(variable: &str, fallback: &str) -> PathBuf {
    match std::env::var_os(variable) {
        Some(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => home().join(fallback),
    }
}

/// `$XDG_CONFIG_HOME/garabato/token.json`.
pub fn config_path() -> PathBuf {
    xdg_dir("XDG_CONFIG_HOME", ".config").join("garabato").join("token.json")
}

/// `$XDG_STATE_HOME/garabato`, where the module writes its log.
pub fn state_dir() -> PathBuf {
    xdg_dir("XDG_STATE_HOME", ".local/state").join("garabato")
}

/// Parses the file's text. The address loses any trailing slash.
pub fn parse(text: &str) -> Result<Config, ConfigError> {
    let config: Config =
        serde_json::from_str(text).map_err(|error| ConfigError::Invalid(error.to_string()))?;
    let url = config.url.trim().trim_end_matches('/').to_string();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(ConfigError::Invalid("url must start with https:// or http://".into()));
    }
    let key = config.key.trim().to_string();
    if key.is_empty() {
        return Err(ConfigError::Invalid("key is empty".into()));
    }
    Ok(Config { url, key })
}

/// Reads the file, refusing it when group or others can read it.
pub fn load(path: &Path) -> Result<Config, ConfigError> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(ConfigError::Missing(path.to_path_buf()));
        }
        Err(error) => return Err(ConfigError::Unreadable(error.to_string())),
    };
    if metadata.permissions().mode() & 0o077 != 0 {
        return Err(ConfigError::Exposed(path.to_path_buf()));
    }
    let text = fs::read_to_string(path).map_err(|error| ConfigError::Unreadable(error.to_string()))?;
    parse(&text)
}
