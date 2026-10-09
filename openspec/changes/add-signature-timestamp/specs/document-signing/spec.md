## ADDED Requirements

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

## MODIFIED Requirements

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
