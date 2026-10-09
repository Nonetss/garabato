## MODIFIED Requirements

### Requirement: Signature records

Every successful signature SHALL be recorded with the document, the version it produced, the certificate used, the signing user, the signing time, the pages showing the stamp (none when invisible), the rectangle, the reason and location, the SHA-256 of the document before and after signing, the client IP address when the request carries it, and, when the signature carries a timestamp, the time the TSA asserted and the TSA's name (both empty otherwise). Records SHALL never be changed or deleted by the API, and SHALL keep naming the document, the certificate and the version after any of them is deleted. A record whose version has been deleted SHALL no longer count as a signature of the document: it SHALL be left out of the document's signature count, its last signature date and its signing status.

#### Scenario: Record of a visible signature

- **WHEN** the user signs page 1 of a document visibly
- **THEN** a record SHALL exist naming that document, the new version, the certificate, the user, the time, page 1, the rectangle and both hashes

#### Scenario: Record of a timestamped signature

- **WHEN** the user signs with a configured TSA whose token asserts 2026-10-09 10:15:02 UTC
- **THEN** the record SHALL keep that time and the name of the TSA that issued the token

#### Scenario: Certificate deleted later

- **WHEN** a certificate used for signing is deleted afterwards
- **THEN** the signature records made with it SHALL still show its holder name and alias

#### Scenario: Signed version deleted later

- **WHEN** the owner deletes the version a signature produced
- **THEN** the signature record SHALL be kept with its version number, and the document SHALL no longer count it as one of its signatures

### Requirement: Signature history

The system SHALL list signature records for the caller, filtered either by one of their documents or by one of their certificates, newest first, each with the document name, the version number and whether that version has been deleted, the certificate alias and holder, the signing time, the pages, and the timestamp time and authority when the signature carries one. A document or certificate that does not belong to the caller SHALL answer not found. The signature history on the document page SHALL mark each timestamped signature as "Sello de tiempo" with the TSA's time, and show the version of each signature whose version has been deleted marked "(eliminada)", as in "v2 (eliminada)".

#### Scenario: History of a certificate

- **WHEN** the owner lists the signatures of a certificate used on two documents
- **THEN** the response SHALL contain both records with their document names

#### Scenario: Timestamped signature in the document history

- **WHEN** the owner opens a document whose last signature carries a timestamp
- **THEN** that signature's entry SHALL show "Sello de tiempo" with the time the TSA asserted

#### Scenario: Signature of a deleted version in the document history

- **WHEN** the owner opens a document whose signed version 2 they deleted
- **THEN** the history SHALL still list that signature, with its version shown as "v2 (eliminada)"
