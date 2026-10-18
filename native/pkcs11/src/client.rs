//! Calls to Garabato's browser token procedures (`/api/v1/certificateToken`),
//! authenticated with the token key in `x-api-key`.

use std::time::Duration;

use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{config::Config, identity::Identity, identity::rsa_public_key};

const TIMEOUT: Duration = Duration::from_secs(20);
const LOCK_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug, PartialEq, Eq)]
pub enum UnlockOutcome {
    Unlocked,
    /// Wrong or already used code.
    WrongCode,
    /// Too many wrong codes: unlocking is refused for a while.
    LockedOut,
    /// The key is not valid or its owner has two-factor authentication off.
    Refused,
    /// An administrator turned the token off, or this module is too old.
    Blocked(Blocked),
    Unreachable(String),
}

/// Why Garabato refuses every request of this module, with its own status
/// code, never the 403 of a closed signing window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Blocked {
    /// 503: an administrator turned the browser token off.
    TokenDisabled,
    /// 412: this module is older than the minimum version.
    ModuleOutdated,
}

impl Blocked {
    pub fn as_str(self) -> &'static str {
        match self {
            Blocked::TokenDisabled => "token-disabled",
            Blocked::ModuleOutdated => "module-outdated",
        }
    }
}

fn blocked_by(status: Option<u16>) -> Option<Blocked> {
    match status {
        Some(503) => Some(Blocked::TokenDisabled),
        Some(412) => Some(Blocked::ModuleOutdated),
        _ => None,
    }
}

/// What the module tells Garabato about itself: `<version> <os>-<arch>`.
pub fn module_identity() -> String {
    format!(
        "{} {}-{}",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        std::env::consts::ARCH
    )
}

#[derive(Debug, PartialEq, Eq)]
pub enum SignOutcome {
    Signed(Vec<u8>),
    /// The signing window is closed: the browser has to ask for a code.
    WindowClosed,
    Failed(String),
}

#[derive(Deserialize)]
struct OfferedCertificate {
    id: String,
    alias: String,
    certificate: String,
}

#[derive(Deserialize)]
struct Signature {
    signature: String,
}

pub struct Client {
    base: String,
    key: String,
    agent: ureq::Agent,
}

fn status_of(error: &ureq::Error) -> Option<u16> {
    match error {
        ureq::Error::Status(status, _) => Some(*status),
        ureq::Error::Transport(_) => None,
    }
}

impl Client {
    pub fn new(config: &Config) -> Self {
        Client {
            base: format!("{}/api/v1/certificateToken", config.url),
            key: config.key.clone(),
            agent: ureq::AgentBuilder::new().timeout(TIMEOUT).build(),
        }
    }

    /// A request with the token key and the module's identity.
    fn request(&self, verb: &str, method: &str) -> ureq::Request {
        self.agent
            .request(verb, &format!("{}/{method}", self.base))
            .set("x-api-key", &self.key)
            .set("x-garabato-module", &module_identity())
    }

    // ureq's error is large but only lives until it is mapped to an outcome.
    #[allow(clippy::result_large_err)]
    fn post(&self, method: &str, body: Value) -> Result<ureq::Response, ureq::Error> {
        self.request("POST", method).send_json(body)
    }

    /// The certificates the token offers. RSA ones only: anything whose public
    /// key cannot be read is left out.
    pub fn certificates(&self) -> Result<Vec<Identity>, String> {
        let offered: Vec<OfferedCertificate> = self
            .request("GET", "certificates")
            .call()
            .map_err(|error| match blocked_by(status_of(&error)) {
                Some(blocked) => blocked.as_str().to_string(),
                None => error.to_string(),
            })?
            .into_json()
            .map_err(|error| error.to_string())?;
        let mut identities = Vec::new();
        for item in offered {
            let Ok(certificate) = B64.decode(&item.certificate) else {
                continue;
            };
            let Some(public_key) = rsa_public_key(&certificate) else {
                continue;
            };
            identities.push(Identity {
                id: item.id,
                alias: item.alias,
                certificate,
                public_key,
            });
        }
        Ok(identities)
    }

    pub fn unlock(&self, code: &str) -> UnlockOutcome {
        match self.post("unlock", json!({ "code": code })) {
            Ok(_) => UnlockOutcome::Unlocked,
            Err(error) => match status_of(&error) {
                Some(400) => UnlockOutcome::WrongCode,
                Some(429) => UnlockOutcome::LockedOut,
                Some(401 | 403) => UnlockOutcome::Refused,
                status => match blocked_by(status) {
                    Some(blocked) => UnlockOutcome::Blocked(blocked),
                    None => UnlockOutcome::Unreachable(error.to_string()),
                },
            },
        }
    }

    /// Closes the signing window; best effort, the window expires anyway.
    pub fn lock(&self) {
        let _ = self
            .request("POST", "lock")
            .timeout(LOCK_TIMEOUT)
            .send_json(json!({}));
    }

    pub fn sign(&self, certificate_id: &str, mechanism: Value, data: &[u8]) -> SignOutcome {
        let body = json!({
            "certificateId": certificate_id,
            "mechanism": mechanism,
            "data": B64.encode(data),
        });
        let response = match self.post("sign", body) {
            Ok(response) => response,
            Err(error) => {
                // Only a closed window is 403; a blocked module must not look
                // logged out, or the browser would ask for a code in a loop.
                let status = status_of(&error);
                if status == Some(403) {
                    return SignOutcome::WindowClosed;
                }
                return match blocked_by(status) {
                    Some(blocked) => SignOutcome::Failed(blocked.as_str().to_string()),
                    None => SignOutcome::Failed(error.to_string()),
                };
            }
        };
        let signature = response
            .into_json::<Signature>()
            .map_err(|error| error.to_string())
            .and_then(|body| {
                B64.decode(body.signature)
                    .map_err(|error| error.to_string())
            });
        match signature {
            Ok(signature) => SignOutcome::Signed(signature),
            Err(reason) => SignOutcome::Failed(reason),
        }
    }
}
