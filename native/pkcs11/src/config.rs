//! Where the module finds Garabato: a JSON file with the Garabato address and
//! the token key, in the user's configuration directory (readable by them
//! alone on Linux; `%APPDATA%` is private to the user on Windows).

use std::{
    fmt, fs,
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

/// Which convention the directories follow.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Os {
    /// XDG directories under `$HOME` (Linux).
    Unix,
    /// `%APPDATA%` and `%LOCALAPPDATA%`.
    Windows,
}

pub const CURRENT_OS: Os = if cfg!(windows) { Os::Windows } else { Os::Unix };

fn env_var(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

// The first variable that is set, or `<home variable>/<fallback>`.
fn dir_from(
    var: &dyn Fn(&str) -> Option<String>,
    variable: &str,
    home: &str,
    fallback: &str,
) -> PathBuf {
    if let Some(dir) = var(variable) {
        return PathBuf::from(dir);
    }
    let base = var(home)
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    fallback.split('/').fold(base, |path, part| path.join(part))
}

/// Configuration directory: `%APPDATA%\Garabato` on Windows,
/// `$XDG_CONFIG_HOME/garabato` elsewhere. `var` reads the environment.
pub fn config_dir_for(os: Os, var: &dyn Fn(&str) -> Option<String>) -> PathBuf {
    match os {
        Os::Windows => dir_from(var, "APPDATA", "USERPROFILE", "AppData/Roaming").join("Garabato"),
        Os::Unix => dir_from(var, "XDG_CONFIG_HOME", "HOME", ".config").join("garabato"),
    }
}

/// Where the module writes its log: `%LOCALAPPDATA%\Garabato` on Windows,
/// `$XDG_STATE_HOME/garabato` elsewhere.
pub fn state_dir_for(os: Os, var: &dyn Fn(&str) -> Option<String>) -> PathBuf {
    match os {
        Os::Windows => {
            dir_from(var, "LOCALAPPDATA", "USERPROFILE", "AppData/Local").join("Garabato")
        }
        Os::Unix => dir_from(var, "XDG_STATE_HOME", "HOME", ".local/state").join("garabato"),
    }
}

/// The configuration file of this machine.
pub fn config_path() -> PathBuf {
    config_dir_for(CURRENT_OS, &env_var).join("token.json")
}

/// The log directory of this machine.
pub fn state_dir() -> PathBuf {
    state_dir_for(CURRENT_OS, &env_var)
}

// Group or others can read the file. Windows relies on the profile's ACLs.
#[cfg(unix)]
fn is_exposed(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o077 != 0
}

#[cfg(not(unix))]
fn is_exposed(_: &fs::Metadata) -> bool {
    false
}

/// Parses the file's text. The address loses any trailing slash.
pub fn parse(text: &str) -> Result<Config, ConfigError> {
    let config: Config =
        serde_json::from_str(text).map_err(|error| ConfigError::Invalid(error.to_string()))?;
    let url = config.url.trim().trim_end_matches('/').to_string();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(ConfigError::Invalid(
            "url must start with https:// or http://".into(),
        ));
    }
    let key = config.key.trim().to_string();
    if key.is_empty() {
        return Err(ConfigError::Invalid("key is empty".into()));
    }
    Ok(Config { url, key })
}

/// Reads the file, refusing it on Linux when group or others can read it.
pub fn load(path: &Path) -> Result<Config, ConfigError> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(ConfigError::Missing(path.to_path_buf()));
        }
        Err(error) => return Err(ConfigError::Unreadable(error.to_string())),
    };
    if is_exposed(&metadata) {
        return Err(ConfigError::Exposed(path.to_path_buf()));
    }
    let text =
        fs::read_to_string(path).map_err(|error| ConfigError::Unreadable(error.to_string()))?;
    parse(&text)
}
