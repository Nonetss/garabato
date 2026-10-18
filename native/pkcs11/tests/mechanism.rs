use garabato_pkcs11::{identity::rsa_public_key, mechanism::mechanism_json};
use native_pkcs11_traits::{DigestType, SignatureAlgorithm};
use serde_json::json;

#[test]
fn maps_pkcs1_raw() {
    assert_eq!(
        mechanism_json(&SignatureAlgorithm::RsaPkcs1v15Raw),
        Some(json!({ "name": "rsa-pkcs1" }))
    );
}

#[test]
fn maps_pss_with_its_hash_and_salt() {
    let algorithm = SignatureAlgorithm::RsaPss {
        digest: DigestType::Sha384,
        mask_generation_function: DigestType::Sha384,
        salt_length: 48,
    };
    assert_eq!(
        mechanism_json(&algorithm),
        Some(json!({ "name": "rsa-pss", "hash": "sha384", "saltLength": 48 }))
    );
}

#[test]
fn refuses_pss_with_another_mgf_hash() {
    let algorithm = SignatureAlgorithm::RsaPss {
        digest: DigestType::Sha256,
        mask_generation_function: DigestType::Sha1,
        salt_length: 32,
    };
    assert_eq!(mechanism_json(&algorithm), None);
}

#[test]
fn refuses_what_tls_does_not_need() {
    assert_eq!(mechanism_json(&SignatureAlgorithm::Ecdsa), None);
    assert_eq!(mechanism_json(&SignatureAlgorithm::RsaPkcs1v15Sha256), None);
    let sha1 = SignatureAlgorithm::RsaPss {
        digest: DigestType::Sha1,
        mask_generation_function: DigestType::Sha1,
        salt_length: 20,
    };
    assert_eq!(mechanism_json(&sha1), None);
}

#[test]
fn reads_the_pkcs1_public_key_of_an_rsa_certificate() {
    let certificate = include_bytes!("fixtures/rsa.der");
    let expected = include_bytes!("fixtures/rsa-public.der");
    assert_eq!(rsa_public_key(certificate).as_deref(), Some(&expected[..]));
}

#[test]
fn leaves_ec_certificates_out() {
    assert_eq!(rsa_public_key(include_bytes!("fixtures/ec.der")), None);
}
