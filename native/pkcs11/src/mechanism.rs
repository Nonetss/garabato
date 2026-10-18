//! The PKCS#11 mechanisms the token signs with, as the backend names them.

use native_pkcs11_traits::{DigestType, SignatureAlgorithm};
use pkcs11_sys::{CK_MECHANISM_TYPE, CKM_RSA_PKCS, CKM_RSA_PKCS_PSS};
use serde_json::{Value, json};

/// What the token advertises: TLS client authentication needs nothing else.
pub const SUPPORTED_MECHANISMS: [CK_MECHANISM_TYPE; 2] = [CKM_RSA_PKCS, CKM_RSA_PKCS_PSS];

fn hash_name(digest: &DigestType) -> Option<&'static str> {
    match digest {
        DigestType::Sha256 => Some("sha256"),
        DigestType::Sha384 => Some("sha384"),
        DigestType::Sha512 => Some("sha512"),
        DigestType::Sha1 | DigestType::Sha224 => None,
    }
}

/// The `mechanism` field of the backend's sign request, or `None` for a
/// mechanism the token does not sign with.
pub fn mechanism_json(algorithm: &SignatureAlgorithm) -> Option<Value> {
    match algorithm {
        SignatureAlgorithm::RsaPkcs1v15Raw => Some(json!({ "name": "rsa-pkcs1" })),
        SignatureAlgorithm::RsaPss {
            digest,
            mask_generation_function,
            salt_length,
        } => {
            let hash = hash_name(digest)?;
            if hash_name(mask_generation_function) != Some(hash) {
                return None;
            }
            Some(json!({ "name": "rsa-pss", "hash": hash, "saltLength": salt_length }))
        }
        _ => None,
    }
}
