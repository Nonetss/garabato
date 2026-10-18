mod support;

use base64::{Engine, engine::general_purpose::STANDARD as B64};
use garabato_pkcs11::{
    client::{Client, SignOutcome, UnlockOutcome},
    config::Config,
};
use serde_json::{Value, json};

fn client(url: &str) -> Client {
    Client::new(&Config {
        url: url.into(),
        key: "gbt_key".into(),
    })
}

fn body(request: &support::Request) -> Value {
    serde_json::from_str(&request.body).unwrap()
}

#[test]
fn lists_rsa_certificates_with_the_key_header() {
    let rsa = B64.encode(include_bytes!("fixtures/rsa.der"));
    let ec = B64.encode(include_bytes!("fixtures/ec.der"));
    let response = format!(
        r#"[{{"id":"a","alias":"FNMT","holder":"X","certificate":"{rsa}"}},{{"id":"b","alias":"EC","holder":"Y","certificate":"{ec}"}}]"#
    );
    let stub = support::serve(vec![(200, Box::leak(response.into_boxed_str()))]);

    let identities = client(&stub.url).certificates().unwrap();

    assert_eq!(identities.len(), 1);
    assert_eq!(identities[0].alias, "FNMT");
    assert_eq!(
        identities[0].public_key,
        include_bytes!("fixtures/rsa-public.der")
    );
    let request = stub.requests.lock().unwrap()[0].clone();
    assert_eq!(request.method, "GET");
    assert_eq!(request.path, "/api/v1/certificateToken/certificates");
    assert_eq!(request.api_key.as_deref(), Some("gbt_key"));
}

#[test]
fn unlock_maps_each_answer() {
    let stub = support::serve(vec![
        (200, r#"{"expiresAt":"2026-01-01T10:15:00.000Z"}"#),
        (400, r#"{"code":"BAD_REQUEST"}"#),
        (429, r#"{"code":"TOO_MANY_REQUESTS"}"#),
        (403, r#"{"code":"FORBIDDEN"}"#),
    ]);
    let client = client(&stub.url);

    assert_eq!(client.unlock("123456"), UnlockOutcome::Unlocked);
    assert_eq!(client.unlock("000000"), UnlockOutcome::WrongCode);
    assert_eq!(client.unlock("000000"), UnlockOutcome::LockedOut);
    assert_eq!(client.unlock("000000"), UnlockOutcome::Refused);
    let requests = stub.requests.lock().unwrap();
    assert_eq!(requests[0].path, "/api/v1/certificateToken/unlock");
    assert_eq!(body(&requests[0]), json!({ "code": "123456" }));
}

#[test]
fn unlock_reports_an_unreachable_garabato() {
    assert!(matches!(
        client("http://127.0.0.1:9").unlock("123456"),
        UnlockOutcome::Unreachable(_)
    ));
}

#[test]
fn sign_sends_the_mechanism_and_returns_the_signature() {
    let stub = support::serve(vec![(200, r#"{"signature":"AQID"}"#)]);
    let mechanism = json!({ "name": "rsa-pss", "hash": "sha256", "saltLength": 32 });

    let outcome = client(&stub.url).sign("cert-1", mechanism.clone(), &[9, 9]);

    assert_eq!(outcome, SignOutcome::Signed(vec![1, 2, 3]));
    let request = stub.requests.lock().unwrap()[0].clone();
    assert_eq!(request.path, "/api/v1/certificateToken/sign");
    assert_eq!(
        body(&request),
        json!({ "certificateId": "cert-1", "mechanism": mechanism, "data": "CQk=" })
    );
}

#[test]
fn sign_reports_a_closed_window() {
    let stub = support::serve(vec![(403, r#"{"code":"FORBIDDEN"}"#)]);
    assert_eq!(
        client(&stub.url).sign("cert-1", json!({ "name": "rsa-pkcs1" }), &[1]),
        SignOutcome::WindowClosed
    );
}

#[test]
fn sign_reports_other_failures() {
    let stub = support::serve(vec![(404, r#"{"code":"NOT_FOUND"}"#)]);
    assert!(matches!(
        client(&stub.url).sign("cert-1", json!({ "name": "rsa-pkcs1" }), &[1]),
        SignOutcome::Failed(_)
    ));
}

#[test]
fn lock_posts_to_lock() {
    let stub = support::serve(vec![(200, r#"{"locked":true}"#)]);

    client(&stub.url).lock();

    assert_eq!(
        stub.requests.lock().unwrap()[0].path,
        "/api/v1/certificateToken/lock"
    );
}
