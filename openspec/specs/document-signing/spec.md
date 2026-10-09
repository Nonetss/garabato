# Document Signing

## Purpose

Lets users sign their PDF documents with the certificates they keep in the platform, as AutoFirma does on the desktop: a PAdES signature, invisible or with a visible stamp placed by the user on one page or on every page, recorded so each document and each certificate keeps a history of the signatures made.

## Requirements

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

The signed PDF SHALL contain a PAdES baseline signature: a detached CAdES signature (`ETSI.CAdES.detached`) using SHA-256, carrying the signer certificate and its chain from the PKCS#12 file and the ESS signing-certificate-v2 attribute, with the signing time in the signature dictionary. Without a configured TSA the signature SHALL be at level B-B; with one, it SHALL also carry the signature-time-stamp attribute, reaching level B-T. The signature SHALL be added as an incremental update, so the bytes of the signed version start with the bytes of the version it signs, and every signature already in the document SHALL remain valid. RSA and EC certificates SHALL both be supported.

#### Scenario: Validated by a standard tool

- **WHEN** a signed version is checked with a PDF signature validator such as `pdfsig`
- **THEN** the signature SHALL be reported as valid, of type `ETSI.CAdES.detached`, covering the whole document, and naming the certificate holder

#### Scenario: Timestamp recognized by a standard tool

- **WHEN** a version signed with a configured TSA is checked with a PAdES validator
- **THEN** the signature SHALL be reported valid at level B-T, with the timestamp's time and authority

#### Scenario: Signing twice

- **WHEN** a document is signed a second time, with the same or another certificate
- **THEN** both signatures SHALL be reported valid, and the first SHALL be reported as covering the revision it signed

#### Scenario: Original preserved

- **WHEN** a signed version is compared with the version it was made from
- **THEN** the signed bytes SHALL begin with the previous version's bytes unchanged

### Requirement: Signature timestamp from a TSA

When a time-stamping authority is configured (`TSA_URL`), the system SHALL obtain, for every new signature, an RFC 3161 timestamp token over the SHA-256 of the signature value, requesting the TSA's certificate and sending a random nonce, and SHALL embed the token in the signature as the CMS signature-time-stamp unsigned attribute. Before embedding it, the system SHALL check that the TSA granted the request, that the token's message imprint and nonce match the request, and that the token's own signature verifies with the certificate it carries. When the TSA cannot be reached within 10 seconds, answers an HTTP error, rejects the request or returns a token that fails any check, the signature SHALL fail with a Spanish error saying the timestamp could not be obtained and nothing SHALL be stored. When no TSA is configured, the system SHALL sign without a timestamp and SHALL make no request.

#### Scenario: Signed with a configured TSA

- **WHEN** `TSA_URL` is set and the owner signs a document
- **THEN** the new version's signature SHALL carry a timestamp token issued by that TSA over its signature value

#### Scenario: TSA unreachable

- **WHEN** `TSA_URL` is set and the TSA does not answer within 10 seconds
- **THEN** the system SHALL reject the signature with a service-unavailable error saying the timestamp could not be obtained, and SHALL store no version and no record

#### Scenario: TSA rejects the request

- **WHEN** the TSA answers with a status other than granted, or with a token whose message imprint or nonce does not match the request
- **THEN** the system SHALL reject the signature with a bad-gateway error and SHALL store nothing

#### Scenario: No TSA configured

- **WHEN** `TSA_URL` is not set and the owner signs a document
- **THEN** the system SHALL produce a signature without a timestamp and SHALL not contact any TSA

### Requirement: Signature appearance

A signature SHALL be either invisible or visible. A visible signature SHALL be placed on a rectangle the user chose on one reference page, given as fractions of that page's visible area, and SHALL be shown either on that page only or at the same relative position on every page. The stamp SHALL follow the layout of Adobe's default signature appearance, with no box or background: the certificate holder's name on the left half, centred line by line and as large as fits, splitting only tokens with digits (the NIF) when a word does not fit whole; and on the right half, in a smaller size, "Firmado por:" with the holder's name, "Fecha:" with the signing date and time in the Europe/Madrid time zone as `YYYY-MM-DD HH:MM:SS` followed by the zone abbreviation (`CET`/`CEST`), and the reason ("Motivo:") and location ("Lugar:") when given. Both columns SHALL shrink to fit the rectangle. A visible signature SHALL show where it was placed regardless of the page's rotation or crop box.

#### Scenario: Stamp layout

- **WHEN** the holder "MORENO LOPEZ BARAJAS ANTONIO - 77225780Z" signs visibly on 7 October 2026 at 18:43:43 Madrid time
- **THEN** the stamp SHALL show that name large on the left and, on the right, "Firmado por:", the name, "Fecha:" and "2026-10-07 18:43:43 CEST"

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

Every successful signature SHALL be recorded with the document, the version it produced, the certificate used, the signing user, the signing time, the pages showing the stamp (none when invisible), the rectangle, the reason and location, the SHA-256 of the document before and after signing, the client IP address when the request carries it, and, when the signature carries a timestamp, the time the TSA asserted and the TSA's name (both empty otherwise). Records SHALL never be changed or deleted by the API, and SHALL keep naming the document and the certificate after either is deleted.

#### Scenario: Record of a visible signature

- **WHEN** the user signs page 1 of a document visibly
- **THEN** a record SHALL exist naming that document, the new version, the certificate, the user, the time, page 1, the rectangle and both hashes

#### Scenario: Record of a timestamped signature

- **WHEN** the user signs with a configured TSA whose token asserts 2026-10-09 10:15:02 UTC
- **THEN** the record SHALL keep that time and the name of the TSA that issued the token

#### Scenario: Certificate deleted later

- **WHEN** a certificate used for signing is deleted afterwards
- **THEN** the signature records made with it SHALL still show its holder name and alias

### Requirement: Signature history

The system SHALL list signature records for the caller, filtered either by one of their documents or by one of their certificates, newest first, each with the document name, the version number, the certificate alias and holder, the signing time, the pages, and the timestamp time and authority when the signature carries one. A document or certificate that does not belong to the caller SHALL answer not found. The signature history on the document page SHALL mark each timestamped signature as "Sello de tiempo" with the TSA's time.

#### Scenario: History of a certificate

- **WHEN** the owner lists the signatures of a certificate used on two documents
- **THEN** the response SHALL contain both records with their document names

#### Scenario: Timestamped signature in the document history

- **WHEN** the owner opens a document whose last signature carries a timestamp
- **THEN** that signature's entry SHALL show "Sello de tiempo" with the time the TSA asserted

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
