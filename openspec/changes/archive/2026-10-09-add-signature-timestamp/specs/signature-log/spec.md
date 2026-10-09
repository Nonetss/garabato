## MODIFIED Requirements

### Requirement: List the signature log

The system SHALL return the caller's signature records across all their documents and certificates, newest signing time first, ties broken by record id descending, including records whose document or certificate has been deleted. The response SHALL be paginated by an opaque cursor: a page holds at most the requested limit (25 by default, at most 100), carries the cursor of the next page or none when there are no more records, and carries the total number of records that match the filters regardless of pagination. A malformed cursor SHALL be rejected with a bad-request error. Records of other users SHALL never be returned.

Each record SHALL carry: the document id and name, whether the document is deleted, the version id and number the signature produced, the signing time, whether the signature is visible and the 0-based pages showing the stamp, the stamp rectangle, the reason and location, the SHA-256 of the document before and after signing, the client IP address when it was recorded, the time asserted by the timestamp authority and its name when the signature carries a timestamp (null otherwise), and the certificate's id, alias, holder name, tax identifier, issuer name, serial number, SHA-256 fingerprint, validity start and end, and whether it is deleted.

#### Scenario: Records across documents and certificates

- **WHEN** a user has signed document A with certificate X and document B with certificate Y
- **THEN** the log SHALL contain both records, the most recent first, each naming its document and certificate

#### Scenario: Paging through the log

- **WHEN** a user with 30 records requests a page of 25 and then the page after its cursor
- **THEN** the first page SHALL hold the 25 most recent records with a next cursor and a total of 30, and the second SHALL hold the remaining 5 with no next cursor, with no record repeated or skipped

#### Scenario: Records survive deletions

- **WHEN** the document or the certificate of a record has been deleted
- **THEN** the record SHALL still be listed with the document name and the certificate's alias and holder, flagged as deleted

#### Scenario: Only the caller's records

- **WHEN** two users have each signed documents
- **THEN** each user's log SHALL contain only their own records

#### Scenario: Malformed cursor

- **WHEN** the request sends a cursor the system did not issue
- **THEN** the system SHALL reject it with a bad-request error

### Requirement: Signature detail

Choosing a row SHALL open a detail panel for that record without leaving the page, showing: the document name, linked to `/documents/[id]` unless the document is deleted; the version number; the signing date and time with seconds; invisible, or visible with its pages; the reason and location when present; the SHA-256 before and after signing and the certificate fingerprint, each copyable; the client IP when recorded; the timestamp as "Sello de tiempo" with the time the TSA asserted, with seconds, and the TSA's name, or "Sin sello de tiempo" when the signature carries none; and the certificate's alias, holder, tax identifier, issuer, serial number and validity period, marked "eliminado" when deleted.

#### Scenario: Detail of a visible signature

- **WHEN** the user opens a record signed visibly on pages 1 and 3 with a reason
- **THEN** the panel SHALL show "Visible en páginas 1, 3", the reason, both hashes and the certificate data

#### Scenario: Deleted document

- **WHEN** the user opens a record whose document has been deleted
- **THEN** the panel SHALL show the document name marked "eliminado" and SHALL not link to it

#### Scenario: Detail of a timestamped signature

- **WHEN** the user opens a record whose signature carries a timestamp from `FreeTSA`
- **THEN** the panel SHALL show "Sello de tiempo" with the TSA's time and `FreeTSA`
