//! A certificate offered through the token, as the module presents it.

use x509_cert::{
    Certificate,
    der::{Decode, asn1::ObjectIdentifier},
};

const RSA_ENCRYPTION: ObjectIdentifier = ObjectIdentifier::new_unwrap("1.2.840.113549.1.1.1");

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identity {
    /// Garabato's certificate id; also the PKCS#11 `CKA_ID` that links the
    /// certificate to its keys.
    pub id: String,
    pub alias: String,
    pub certificate: Vec<u8>,
    /// PKCS#1 `RSAPublicKey` DER, the form native-pkcs11 parses.
    pub public_key: Vec<u8>,
}

/// The PKCS#1 public key inside an RSA certificate's DER (the bit string of
/// its SubjectPublicKeyInfo), or `None` for anything else.
pub fn rsa_public_key(certificate: &[u8]) -> Option<Vec<u8>> {
    let certificate = Certificate::from_der(certificate).ok()?;
    let info = certificate.tbs_certificate.subject_public_key_info;
    if info.algorithm.oid != RSA_ENCRYPTION {
        return None;
    }
    info.subject_public_key.as_bytes().map(<[u8]>::to_vec)
}
