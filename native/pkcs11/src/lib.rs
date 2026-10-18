//! Garabato's browser certificate token: a PKCS#11 module that Firefox and
//! Chromium (NSS, Linux) load as a security device. It shows the certificates
//! Garabato offers through the token as if they were on a smart card and
//! forwards every signature to Garabato; private keys never leave the server.
//!
//! The PIN the browser asks for is the user's TOTP code: logging in unlocks a
//! signing window in Garabato. Built on `native-pkcs11`, whose token never
//! asks for a PIN, so a few entries of its function list are wrapped here to
//! behave like a smart card: private keys stay hidden and signing is refused
//! until login.

#![allow(non_snake_case)]

pub mod client;
pub mod config;
pub mod identity;
pub mod log;
pub mod mechanism;

use std::{
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

use native_pkcs11::FUNC_LIST;
use native_pkcs11_traits::{
    Backend, Certificate, KeyAlgorithm, KeySearchOptions, PrivateKey, PublicKey,
    SignatureAlgorithm, register_backend,
};
use pkcs11_sys::*;
use serde_json::json;

use crate::{
    client::{Client, SignOutcome, UnlockOutcome},
    config::{config_path, load},
    identity::Identity,
    log::log,
    mechanism::{SUPPORTED_MECHANISMS, mechanism_json},
};

type Result<T> = native_pkcs11_traits::Result<T>;

const TOKEN_LABEL: &str = "Garabato";
// Label no key ever has: the template used to hide private keys before login.
const LOCKED_LABEL: &[u8] = b"garabato-locked";
// How long the list of certificates is reused before asking Garabato again.
const CERTIFICATES_TTL: Duration = Duration::from_secs(60);
// After a failure (Garabato unreachable, key revoked, no configuration) the
// token stays empty this long before asking again: NSS lists the token's
// objects several times a second while a page loads.
const CERTIFICATES_RETRY: Duration = Duration::from_secs(10);
// A caller may sign once to learn the length and again to fill the buffer;
// the same data within this window reuses the signature.
const SIGNATURE_REUSE: Duration = Duration::from_secs(5);

static LOGGED_IN: AtomicBool = AtomicBool::new(false);
// Set when Garabato refused a signature because the window closed, so the
// `C_Sign` wrapper can answer `CKR_USER_NOT_LOGGED_IN`.
static WINDOW_CLOSED: AtomicBool = AtomicBool::new(false);
static ORIGINAL: OnceLock<CK_FUNCTION_LIST> = OnceLock::new();
static PATCHED: OnceLock<CK_FUNCTION_LIST> = OnceLock::new();
/// The certificates and until when they are reused.
static CERTIFICATES: Mutex<Option<(Instant, Vec<Arc<Identity>>)>> = Mutex::new(None);
/// The last signature: the data, the signature and when it was made.
type ReusableSignature = (Vec<u8>, Vec<u8>, Instant);
static LAST_SIGNATURE: Mutex<Option<ReusableSignature>> = Mutex::new(None);

/// A client for the configured Garabato, or none when the configuration is
/// missing or unsafe (logged; the token then shows no certificates).
fn client() -> Option<Client> {
    match load(&config_path()) {
        Ok(config) => Some(Client::new(&config)),
        Err(error) => {
            log("config-error", json!({ "error": error.to_string() }));
            None
        }
    }
}

fn certificates() -> Vec<Arc<Identity>> {
    let mut cached = CERTIFICATES.lock().unwrap();
    if let Some((until, identities)) = cached.as_ref()
        && Instant::now() < *until
    {
        return identities.clone();
    }
    let Some(client) = client() else {
        *cached = Some((Instant::now() + CERTIFICATES_RETRY, Vec::new()));
        return Vec::new();
    };
    match client.certificates() {
        Ok(identities) => {
            log("certificates", json!({ "count": identities.len() }));
            let identities: Vec<Arc<Identity>> = identities.into_iter().map(Arc::new).collect();
            *cached = Some((Instant::now() + CERTIFICATES_TTL, identities.clone()));
            identities
        }
        Err(error) => {
            log("certificates-error", json!({ "error": error }));
            *cached = Some((Instant::now() + CERTIFICATES_RETRY, Vec::new()));
            Vec::new()
        }
    }
}

fn find(query: &KeySearchOptions) -> Option<Arc<Identity>> {
    certificates().into_iter().find(|identity| match query {
        KeySearchOptions::Id(id) => id.as_slice() == identity.id.as_bytes(),
        KeySearchOptions::Label(label) => *label == identity.alias,
    })
}

// ---------------------------------------------------------------- objects --

#[derive(Debug)]
struct GarabatoPublicKey(Arc<Identity>);

impl PublicKey for GarabatoPublicKey {
    fn id(&self) -> Vec<u8> {
        self.0.id.as_bytes().to_vec()
    }

    fn label(&self) -> String {
        self.0.alias.clone()
    }

    fn to_der(&self) -> Vec<u8> {
        self.0.public_key.clone()
    }

    fn verify(&self, _: &SignatureAlgorithm, _: &[u8], _: &[u8]) -> Result<()> {
        Err("the token does not verify signatures".into())
    }

    fn delete(self: Box<Self>) {}

    fn algorithm(&self) -> KeyAlgorithm {
        KeyAlgorithm::Rsa
    }
}

#[derive(Debug)]
struct GarabatoCertificate(GarabatoPublicKey);

impl Certificate for GarabatoCertificate {
    fn id(&self) -> Vec<u8> {
        self.0.id()
    }

    fn label(&self) -> String {
        self.0.label()
    }

    fn to_der(&self) -> Vec<u8> {
        self.0.0.certificate.clone()
    }

    fn public_key(&self) -> &dyn PublicKey {
        &self.0
    }

    fn delete(self: Box<Self>) {}
}

struct GarabatoPrivateKey(Arc<Identity>);

impl PrivateKey for GarabatoPrivateKey {
    fn id(&self) -> Vec<u8> {
        self.0.id.as_bytes().to_vec()
    }

    fn label(&self) -> String {
        self.0.alias.clone()
    }

    fn sign(&self, algorithm: &SignatureAlgorithm, data: &[u8]) -> Result<Vec<u8>> {
        let Some(mechanism) = mechanism_json(algorithm) else {
            log(
                "sign-unsupported",
                json!({ "algorithm": format!("{algorithm:?}") }),
            );
            return Err("mechanism not supported".into());
        };
        if !LOGGED_IN.load(Ordering::SeqCst) {
            log("sign-refused-not-logged-in", json!({}));
            WINDOW_CLOSED.store(true, Ordering::SeqCst);
            return Err("token not logged in".into());
        }
        if let Some((last_data, signature, at)) = LAST_SIGNATURE.lock().unwrap().as_ref()
            && last_data == data
            && at.elapsed() < SIGNATURE_REUSE
        {
            return Ok(signature.clone());
        }
        let Some(client) = client() else {
            return Err("no configuration".into());
        };
        let started = Instant::now();
        match client.sign(&self.0.id, mechanism.clone(), data) {
            SignOutcome::Signed(signature) => {
                log(
                    "sign",
                    json!({
                        "certificate": self.0.alias,
                        "mechanism": mechanism,
                        "ms": started.elapsed().as_millis(),
                    }),
                );
                *LAST_SIGNATURE.lock().unwrap() =
                    Some((data.to_vec(), signature.clone(), Instant::now()));
                Ok(signature)
            }
            SignOutcome::WindowClosed => {
                log("sign-window-closed", json!({}));
                LOGGED_IN.store(false, Ordering::SeqCst);
                WINDOW_CLOSED.store(true, Ordering::SeqCst);
                Err("signing window closed".into())
            }
            SignOutcome::Failed(error) => {
                log("sign-failed", json!({ "error": error }));
                Err(error.into())
            }
        }
    }

    fn delete(&self) {}

    fn algorithm(&self) -> KeyAlgorithm {
        KeyAlgorithm::Rsa
    }
}

struct GarabatoBackend;

impl Backend for GarabatoBackend {
    fn name(&self) -> String {
        TOKEN_LABEL.into()
    }

    fn find_all_certificates(&self) -> Result<Vec<Box<dyn Certificate>>> {
        Ok(certificates()
            .into_iter()
            .map(|identity| {
                Box::new(GarabatoCertificate(GarabatoPublicKey(identity))) as Box<dyn Certificate>
            })
            .collect())
    }

    fn find_private_key(&self, query: KeySearchOptions) -> Result<Option<Arc<dyn PrivateKey>>> {
        Ok(find(&query)
            .map(|identity| Arc::new(GarabatoPrivateKey(identity)) as Arc<dyn PrivateKey>))
    }

    fn find_public_key(&self, query: KeySearchOptions) -> Result<Option<Box<dyn PublicKey>>> {
        Ok(
            find(&query)
                .map(|identity| Box::new(GarabatoPublicKey(identity)) as Box<dyn PublicKey>),
        )
    }

    fn find_all_private_keys(&self) -> Result<Vec<Arc<dyn PrivateKey>>> {
        Ok(certificates()
            .into_iter()
            .map(|identity| Arc::new(GarabatoPrivateKey(identity)) as Arc<dyn PrivateKey>)
            .collect())
    }

    fn find_all_public_keys(&self) -> Result<Vec<Arc<dyn PublicKey>>> {
        Ok(certificates()
            .into_iter()
            .map(|identity| Arc::new(GarabatoPublicKey(identity)) as Arc<dyn PublicKey>)
            .collect())
    }

    fn generate_key(&self, _: KeyAlgorithm, _: Option<&str>) -> Result<Arc<dyn PrivateKey>> {
        Err("key generation is not supported".into())
    }
}

// ------------------------------------------------------ wrapped functions --

fn original() -> &'static CK_FUNCTION_LIST {
    ORIGINAL.get().expect("C_GetFunctionList runs first")
}

/// A token that needs a PIN typed by the user, like a smart card.
unsafe extern "C" fn GetTokenInfo(slot: CK_SLOT_ID, info: CK_TOKEN_INFO_PTR) -> CK_RV {
    let rv = unsafe { original().C_GetTokenInfo.unwrap()(slot, info) };
    if rv == CKR_OK && !info.is_null() {
        unsafe {
            (*info).flags = CKF_TOKEN_INITIALIZED
                | CKF_WRITE_PROTECTED
                | CKF_LOGIN_REQUIRED
                | CKF_USER_PIN_INITIALIZED;
            (*info).ulMinPinLen = 6;
            (*info).ulMaxPinLen = 6;
        }
    }
    rv
}

/// Only the mechanisms TLS client authentication uses.
unsafe extern "C" fn GetMechanismList(
    slot: CK_SLOT_ID,
    list: CK_MECHANISM_TYPE_PTR,
    count: CK_ULONG_PTR,
) -> CK_RV {
    if count.is_null() {
        return CKR_ARGUMENTS_BAD;
    }
    let mut ignored: CK_ULONG = 0;
    let rv =
        unsafe { original().C_GetMechanismList.unwrap()(slot, std::ptr::null_mut(), &mut ignored) };
    if rv != CKR_OK {
        return rv;
    }
    let needed = SUPPORTED_MECHANISMS.len() as CK_ULONG;
    let available = unsafe { *count };
    unsafe { *count = needed };
    if list.is_null() {
        return CKR_OK;
    }
    if available < needed {
        return CKR_BUFFER_TOO_SMALL;
    }
    for (index, mechanism) in SUPPORTED_MECHANISMS.iter().enumerate() {
        unsafe { *list.add(index) = *mechanism };
    }
    CKR_OK
}

/// The PIN is the user's TOTP code: logging in unlocks Garabato's window.
unsafe extern "C" fn Login(
    session: CK_SESSION_HANDLE,
    user_type: CK_USER_TYPE,
    pin: CK_UTF8CHAR_PTR,
    pin_len: CK_ULONG,
) -> CK_RV {
    let rv = unsafe { original().C_Login.unwrap()(session, user_type, pin, pin_len) };
    if rv != CKR_OK {
        log(
            "login-rejected-by-session",
            json!({ "rv": format!("0x{rv:x}"), "session": session }),
        );
        return rv;
    }
    if LOGGED_IN.load(Ordering::SeqCst) {
        return CKR_USER_ALREADY_LOGGED_IN;
    }
    if pin.is_null() {
        return CKR_PIN_INCORRECT;
    }
    let bytes = unsafe { std::slice::from_raw_parts(pin, pin_len as usize) };
    let code = String::from_utf8_lossy(bytes).trim().to_string();
    let Some(client) = client() else {
        return CKR_DEVICE_ERROR;
    };
    let outcome = client.unlock(&code);
    let rv = match &outcome {
        UnlockOutcome::Unlocked => {
            LOGGED_IN.store(true, Ordering::SeqCst);
            CKR_OK
        }
        UnlockOutcome::WrongCode | UnlockOutcome::Refused => CKR_PIN_INCORRECT,
        UnlockOutcome::LockedOut => CKR_PIN_LOCKED,
        // The browser shows an error instead of asking for the code again.
        UnlockOutcome::Blocked(_) => CKR_DEVICE_ERROR,
        UnlockOutcome::Unreachable(_) => CKR_DEVICE_ERROR,
    };
    log("login", json!({ "outcome": format!("{outcome:?}") }));
    rv
}

fn lock() {
    LOGGED_IN.store(false, Ordering::SeqCst);
    if let Some(client) = client() {
        client.lock();
    }
}

unsafe extern "C" fn Logout(session: CK_SESSION_HANDLE) -> CK_RV {
    let rv = unsafe { original().C_Logout.unwrap()(session) };
    lock();
    log("logout", json!({}));
    rv
}

/// Tells NSS whether the session is logged in; the crate always says yes.
unsafe extern "C" fn GetSessionInfo(
    session: CK_SESSION_HANDLE,
    info: CK_SESSION_INFO_PTR,
) -> CK_RV {
    let rv = unsafe { original().C_GetSessionInfo.unwrap()(session, info) };
    if rv == CKR_OK && !info.is_null() {
        let read_write = unsafe { (*info).flags } & CKF_RW_SESSION != 0;
        let state = match (LOGGED_IN.load(Ordering::SeqCst), read_write) {
            (true, false) => CKS_RO_USER_FUNCTIONS,
            (true, true) => CKS_RW_USER_FUNCTIONS,
            (false, false) => CKS_RO_PUBLIC_SESSION,
            (false, true) => CKS_RW_PUBLIC_SESSION,
        };
        unsafe { (*info).state = state };
    }
    rv
}

fn searches_private_keys(template: CK_ATTRIBUTE_PTR, count: CK_ULONG) -> bool {
    if template.is_null() {
        return false;
    }
    let attributes = unsafe { std::slice::from_raw_parts(template, count as usize) };
    attributes.iter().any(|attribute| {
        attribute.type_ == CKA_CLASS
            && !attribute.pValue.is_null()
            && attribute.ulValueLen as usize == std::mem::size_of::<CK_OBJECT_CLASS>()
            && unsafe { (attribute.pValue as *const CK_OBJECT_CLASS).read_unaligned() }
                == CKO_PRIVATE_KEY
    })
}

/// Before login a private key search finds nothing, which is what makes NSS
/// ask for the PIN and search again. The crate caches every search for 10 s
/// by template, so the locked search uses a template no real one matches.
unsafe extern "C" fn FindObjectsInit(
    session: CK_SESSION_HANDLE,
    template: CK_ATTRIBUTE_PTR,
    count: CK_ULONG,
) -> CK_RV {
    if LOGGED_IN.load(Ordering::SeqCst) || !searches_private_keys(template, count) {
        return unsafe { original().C_FindObjectsInit.unwrap()(session, template, count) };
    }
    let mut class: CK_OBJECT_CLASS = CKO_PRIVATE_KEY;
    let mut locked = [
        CK_ATTRIBUTE {
            type_: CKA_CLASS,
            pValue: (&raw mut class).cast(),
            ulValueLen: std::mem::size_of::<CK_OBJECT_CLASS>() as CK_ULONG,
        },
        CK_ATTRIBUTE {
            type_: CKA_LABEL,
            pValue: LOCKED_LABEL.as_ptr() as *mut _,
            ulValueLen: LOCKED_LABEL.len() as CK_ULONG,
        },
    ];
    unsafe { original().C_FindObjectsInit.unwrap()(session, locked.as_mut_ptr(), 2) }
}

/// The crate answers every failed signature `CKR_ARGUMENTS_BAD`; a closed
/// window becomes `CKR_USER_NOT_LOGGED_IN`, so NSS asks for a code again.
fn signature_result(rv: CK_RV) -> CK_RV {
    if WINDOW_CLOSED.swap(false, Ordering::SeqCst) && rv != CKR_OK {
        return CKR_USER_NOT_LOGGED_IN;
    }
    rv
}

unsafe extern "C" fn Sign(
    session: CK_SESSION_HANDLE,
    data: CK_BYTE_PTR,
    data_len: CK_ULONG,
    signature: CK_BYTE_PTR,
    signature_len: CK_ULONG_PTR,
) -> CK_RV {
    WINDOW_CLOSED.store(false, Ordering::SeqCst);
    let rv =
        unsafe { original().C_Sign.unwrap()(session, data, data_len, signature, signature_len) };
    signature_result(rv)
}

unsafe extern "C" fn SignFinal(
    session: CK_SESSION_HANDLE,
    signature: CK_BYTE_PTR,
    signature_len: CK_ULONG_PTR,
) -> CK_RV {
    WINDOW_CLOSED.store(false, Ordering::SeqCst);
    let rv = unsafe { original().C_SignFinal.unwrap()(session, signature, signature_len) };
    signature_result(rv)
}

unsafe extern "C" fn Finalize(reserved: CK_VOID_PTR) -> CK_RV {
    if LOGGED_IN.load(Ordering::SeqCst) {
        lock();
    }
    log("finalize", json!({}));
    unsafe { original().C_Finalize.unwrap()(reserved) }
}

/// # Safety
/// Called by the PKCS#11 loader with a valid pointer to store the list in.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn C_GetFunctionList(list: CK_FUNCTION_LIST_PTR_PTR) -> CK_RV {
    if list.is_null() {
        return CKR_ARGUMENTS_BAD;
    }
    register_backend(Box::new(GarabatoBackend));
    let base = *ORIGINAL.get_or_init(|| unsafe { std::ptr::addr_of!(FUNC_LIST).read() });
    let patched = PATCHED.get_or_init(|| CK_FUNCTION_LIST {
        C_GetFunctionList: Some(C_GetFunctionList),
        C_GetTokenInfo: Some(GetTokenInfo),
        C_GetMechanismList: Some(GetMechanismList),
        C_Login: Some(Login),
        C_Logout: Some(Logout),
        C_GetSessionInfo: Some(GetSessionInfo),
        C_FindObjectsInit: Some(FindObjectsInit),
        C_Sign: Some(Sign),
        C_SignFinal: Some(SignFinal),
        C_Finalize: Some(Finalize),
        ..base
    });
    unsafe { *list = (patched as *const CK_FUNCTION_LIST).cast_mut() };
    CKR_OK
}
