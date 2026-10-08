## Purpose

Lets users sign their PDF documents with the certificates they keep in the platform, as AutoFirma does on the desktop: a PAdES signature, invisible or with a visible stamp placed by the user on one page or on every page, recorded so each document and each certificate keeps a history of the signatures made.

## ADDED Requirements

### Requirement: Sign a document

The system SHALL let the owner of a document sign its current version with one of their certificates. The request SHALL name the document, the version the user was looking at, the certificate, the appearance, and optionally a reason and a location (each at most 200 characters). The certificate SHALL belong to the caller, SHALL not be deleted and SHALL be valid at signing time. The password SHALL be the one sent in the request, or the remembered one when the request sends none. The signed PDF SHALL be stored as the document's next version and the response SHALL return the new version and the signature record.

#### Scenario: Sign with a remembered password

- **WHEN** the owner signs the current version with a certificate whose password is remembered and sends no password
- **THEN** the system SHALL sign with the remembered password and store the result as the next version

#### Scenario: Password needed

- **WHEN** the certificate's password is not remembered and the request sends none
- **THEN** the system SHALL reject it with a bad-request error asking for the password and SHALL store nothing

#### Scenario: Wrong password

- **WHEN** the sent password does not open the certificate
- **THEN** the system SHALL reject it with a bad-request error and SHALL store nothing

#### Scenario: Expired certificate

- **WHEN** the chosen certificate's validity has ended
- **THEN** the system SHALL reject the signature with a conflict error and SHALL store nothing

#### Scenario: Another user's certificate

- **WHEN** the request names a certificate that does not belong to the caller or is deleted
- **THEN** the system SHALL answer not found and SHALL store nothing

#### Scenario: Document changed meanwhile

- **WHEN** the version named in the request is no longer the document's current version, because another signature was stored in between
- **THEN** the system SHALL reject the request with a conflict error telling the user to reload, and SHALL store nothing

### Requirement: PAdES baseline signature as an incremental update

The signed PDF SHALL contain a PAdES baseline B-B signature: a detached CAdES signature (`ETSI.CAdES.detached`) using SHA-256, carrying the signer certificate and its chain from the PKCS#12 file and the ESS signing-certificate-v2 attribute, with the signing time in the signature dictionary. The signature SHALL be added as an incremental update, so the bytes of the signed version start with the bytes of the version it signs, and every signature already in the document SHALL remain valid. RSA and EC certificates SHALL both be supported.

#### Scenario: Validated by a standard tool

- **WHEN** a signed version is checked with a PDF signature validator such as `pdfsig`
- **THEN** the signature SHALL be reported as valid, of type `ETSI.CAdES.detached`, covering the whole document, and naming the certificate holder

#### Scenario: Signing twice

- **WHEN** a document is signed a second time, with the same or another certificate
- **THEN** both signatures SHALL be reported valid, and the first SHALL be reported as covering the revision it signed

#### Scenario: Original preserved

- **WHEN** a signed version is compared with the version it was made from
- **THEN** the signed bytes SHALL begin with the previous version's bytes unchanged

### Requirement: Signature appearance

A signature SHALL be either invisible or visible. A visible signature SHALL be placed on a rectangle the user chose on one reference page, given as fractions of that page's visible area, and SHALL be shown either on that page only or at the same relative position on every page. The stamp SHALL read "Firmado digitalmente por" followed by the certificate holder's name, the signing date and time in the Europe/Madrid time zone, and the issuer, plus the reason and the location when given, with the text shrunk to fit the rectangle. A visible signature SHALL show where it was placed regardless of the page's rotation or crop box.

#### Scenario: Invisible signature

- **WHEN** the user signs with an invisible signature
- **THEN** no page SHALL show a stamp, and the document SHALL still carry the signature

#### Scenario: Visible on one page

- **WHEN** the user draws the rectangle on page 3 and chooses that page only
- **THEN** the stamp SHALL appear on page 3, at the drawn position, and on no other page

#### Scenario: Visible on every page

- **WHEN** the user chooses every page
- **THEN** the stamp SHALL appear on each page at the same relative position, and the document SHALL still hold a single signature

#### Scenario: Rotated page

- **WHEN** the user places a visible signature on a page rotated 90 degrees
- **THEN** the stamp SHALL appear where the user drew it, with its text upright as the page is displayed

#### Scenario: Invalid rectangle

- **WHEN** the rectangle falls outside the page, has no area or names a page the document does not have
- **THEN** the system SHALL reject the request with a bad-request error and SHALL store nothing

### Requirement: Signature records

Every successful signature SHALL be recorded with the document, the version it produced, the certificate used, the signing user, the signing time, the pages showing the stamp (none when invisible), the rectangle, the reason and location, the SHA-256 of the document before and after signing, and the client IP address when the request carries it. Records SHALL never be changed or deleted by the API, and SHALL keep naming the document and the certificate after either is deleted.

#### Scenario: Record of a visible signature

- **WHEN** the user signs page 1 of a document visibly
- **THEN** a record SHALL exist naming that document, the new version, the certificate, the user, the time, page 1, the rectangle and both hashes

#### Scenario: Certificate deleted later

- **WHEN** a certificate used for signing is deleted afterwards
- **THEN** the signature records made with it SHALL still show its holder name and alias

### Requirement: Signature history

The system SHALL list signature records for the caller, filtered either by one of their documents or by one of their certificates, newest first, each with the document name, the version number, the certificate alias and holder, the signing time and the pages. A document or certificate that does not belong to the caller SHALL answer not found.

#### Scenario: History of a certificate

- **WHEN** the owner lists the signatures of a certificate used on two documents
- **THEN** the response SHALL contain both records with their document names

### Requirement: Signing on the document page

The document page SHALL offer a "Firmar" action that lets the user:

- choose one of their certificates that is not expired;
- choose between an invisible and a visible signature;
- for a visible one, draw the rectangle on a rendered page and choose between that page and every page;
- type the password only when the chosen certificate's password is not remembered;
- optionally add a reason and a location.

After signing, the page SHALL show the new version and the new record without reloading. All text SHALL be in Spanish and the password SHALL be typed in a masked field.

#### Scenario: No usable certificate

- **WHEN** a user without any certificate that is not expired opens the signing action
- **THEN** the page SHALL explain that a valid certificate is needed and SHALL link to `/certificates`

#### Scenario: Signing error is shown

- **WHEN** signing fails, for example because of a wrong password
- **THEN** the signing panel SHALL stay open, keep the user's choices and show the Spanish error message returned by the API

### Requirement: Signature history on the certificates page

The certificates page SHALL let the user open, for each certificate, the list of signatures made with it, showing the document name, the version, the date and the pages, with a link to each document that still exists.

#### Scenario: Open a certificate's history

- **WHEN** the user chooses "Ver firmas" on a certificate
- **THEN** the page SHALL show the signatures made with that certificate, newest first
