## ADDED Requirements

### Requirement: Check the signatures of a document version

The system SHALL let the owner of a document check the signatures embedded in one of its versions, the current version when none is named. The check SHALL read the stored PDF and SHALL change nothing. It SHALL report every signature field that holds a signature, in the order the signatures were added to the file, whoever made them, including signatures that were already in the uploaded PDF. A version without signatures SHALL answer an empty list. A document or version that does not exist, is deleted or belongs to another user SHALL answer not found.

#### Scenario: Document signed in garabato

- **WHEN** the owner checks a document they signed twice in garabato
- **THEN** the response SHALL list two signatures, the first one first, each naming its certificate holder

#### Scenario: Signatures made elsewhere

- **WHEN** the owner checks a PDF that was uploaded already carrying a signature made with another tool
- **THEN** the response SHALL list that signature with its signer and verdict

#### Scenario: Earlier version

- **WHEN** the owner checks version 1 of a document whose upload had no signatures and that was signed later
- **THEN** the response SHALL be an empty list

#### Scenario: Another user's document

- **WHEN** a user checks a document that belongs to another user
- **THEN** the system SHALL answer not found

### Requirement: What each signature reports

For each signature the system SHALL report:

- the signature field name;
- the SubFilter and, for `ETSI.CAdES.detached`, the PAdES level reached (B-B, or B-T when it carries a valid signature timestamp);
- the claimed signing time from the signature dictionary, and the reason and location when present;
- the signer certificate's holder name, tax identifier when present, issuer name, serial number and validity period;
- the timestamp's time and authority when a signature timestamp is present, and whether the token is valid;
- the results of each check below, each as passed or failed with a reason.

The checks SHALL be:

- **Integrity:** the byte range is well-formed (it starts at 0 and leaves out exactly the `/Contents` value) and the SHA-256 of the covered bytes equals the CMS message-digest attribute.
- **Signature:** the CMS signature verifies with the signer certificate.
- **Coverage:** the signature covers the whole file, or a revision followed only by revisions that add signatures, or a revision followed by other changes.
- **Certificate validity:** the signer certificate was within its validity period at the signing time. The signing time is the timestamp's time when a valid timestamp is present, and the claimed time otherwise.
- **Trust:** the certificate chain, built from the certificates in the signature, reaches one of the trusted roots at the signing time.

Revocation SHALL NOT be checked, and every report SHALL state that revocation was not checked.

#### Scenario: Timestamped signature

- **WHEN** a signature carries a valid signature timestamp from `FreeTSA`
- **THEN** it SHALL be reported at level B-T with the timestamp's time and `FreeTSA`, and its certificate validity SHALL be judged at the timestamp's time

#### Scenario: Signed earlier revision

- **WHEN** a document was signed by A and then by B
- **THEN** A's signature SHALL be reported as covering a revision followed only by signatures, and B's as covering the whole file

#### Scenario: Changed after signing

- **WHEN** a signed PDF had an incremental update appended that changes page content after the signature
- **THEN** that signature SHALL be reported as covering a revision followed by other changes

### Requirement: Verdict per signature

Each signature SHALL carry one verdict:

- **"No válida"** when integrity or the signature check fails, or the certificate was outside its validity at the signing time.
- **"No comprobable"** when the signature cannot be parsed or uses a SubFilter or algorithm the system does not support (e.g. `adbe.x509.rsa_sha1`).
- **"Válida"** when every check passes.
- **"Válida, emisor no reconocido"** when every check passes except trust.

A signature followed by changes other than signatures SHALL keep its verdict on the revision it signed and SHALL carry a warning that the document was modified after it was signed.

#### Scenario: Valid signature from a trusted issuer

- **WHEN** a signature made with an FNMT personal certificate is intact and its certificate was valid when it signed
- **THEN** its verdict SHALL be "Válida"

#### Scenario: Self-signed certificate

- **WHEN** a signature is intact but was made with a certificate whose chain reaches no trusted root
- **THEN** its verdict SHALL be "Válida, emisor no reconocido"

#### Scenario: Tampered bytes

- **WHEN** a byte inside the signed range has been changed
- **THEN** the verdict SHALL be "No válida" with the integrity check failed

#### Scenario: Expired at signing time

- **WHEN** a signature's claimed signing time falls after its certificate's validity ended and it has no timestamp
- **THEN** the verdict SHALL be "No válida" with the certificate validity check failed

#### Scenario: Unsupported signature

- **WHEN** a signature uses the `adbe.x509.rsa_sha1` SubFilter
- **THEN** the verdict SHALL be "No comprobable", naming the unsupported SubFilter

### Requirement: Trusted roots

The trusted roots SHALL be the root certificates bundled with the runtime (the Mozilla root store) plus a set of Spanish roots that issue personal signing certificates, kept in the repository as source and shipped inside the backend bundle: at least FNMT-RCM's `AC RAIZ FNMT-RCM` and the DNIe's `AC RAIZ DNIE 2`. Each bundled root SHALL record the issuer's official download URL and its SHA-256 fingerprint, which a test SHALL pin. Adding a root SHALL only require adding one entry with its certificate, source and fingerprint.

#### Scenario: Personal certificate from FNMT

- **WHEN** a signature's chain ends in `AC RAIZ FNMT-RCM`
- **THEN** the trust check SHALL pass

#### Scenario: Unknown root

- **WHEN** a signature's chain ends in a root that is in neither set
- **THEN** the trust check SHALL fail with a reason naming the root's subject

### Requirement: Signature validity on the document page

The document page SHALL show a "Validez de las firmas" section that checks the current version when the page opens and again after a new signature. It SHALL list each signature with its verdict as a status tag, the signer's name, the signing time (and "Sello de tiempo" with its time when present) and a one-line coverage summary. It SHALL let the user expand a signature to see each check with its reason, the certificate data and the PAdES level. The section SHALL state that revocation is not checked. While checking it SHALL show a loading state, and if the check fails it SHALL show an error with a retry action. A version without signatures SHALL show "Este documento no tiene firmas". All text SHALL be in Spanish.

#### Scenario: Externally signed upload

- **WHEN** the user opens a document uploaded with a valid signature made elsewhere
- **THEN** the section SHALL list that signature as "Válida" (or "Válida, emisor no reconocido") with its signer, even though the document has no signature records in garabato

#### Scenario: After signing

- **WHEN** the user signs the document from the page
- **THEN** the section SHALL check the new version and list the new signature without reloading

#### Scenario: Modified after signing

- **WHEN** a signature covers a revision followed by other changes
- **THEN** the section SHALL show a warning that the document was modified after that signature
