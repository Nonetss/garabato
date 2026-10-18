//! One JSON line per event in `$XDG_STATE_HOME/garabato/pkcs11.log`. Browsers
//! launched from the desktop have no terminal, so the file is the only place
//! to read what happened. Neither the PIN nor the token key is ever logged.

use std::{
    fs::{self, OpenOptions},
    io::Write,
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::{Value, json};

use crate::config::state_dir;

pub fn log(event: &str, detail: Value) {
    let dir = state_dir();
    let _ = fs::create_dir_all(&dir);
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis());
    let line = json!({ "t": millis, "pid": std::process::id(), "event": event, "detail": detail });
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("pkcs11.log"))
    {
        let _ = writeln!(file, "{line}");
    }
}
