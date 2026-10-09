# Signature Log

## Purpose

Gives each user one log of every signature they have made, across all their documents and certificates, so they can find what they signed, when and with which certificate, and read the full evidence kept for each signature.

## Requirements

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

### Requirement: Filter the signature log

The log SHALL accept, all optional and combined with AND: a certificate id, returning only records made with that certificate; a text, returning only records whose document name contains it, case-insensitively, with `%`, `_` and `\` matched literally; a start instant, returning only records signed at or after it; and an end instant, returning only records signed strictly before it. A certificate that does not belong to the caller SHALL answer not found. A start instant that is not before the end instant SHALL be rejected with a bad-request error. The total count SHALL reflect the filters.

#### Scenario: By certificate

- **WHEN** the user filters by certificate X
- **THEN** only records made with X SHALL be listed and the total SHALL count only those

#### Scenario: By document name

- **WHEN** the user filters by the text "contrato" and has signed "Contrato alquiler.pdf" and "factura.pdf"
- **THEN** only the record of "Contrato alquiler.pdf" SHALL be listed

#### Scenario: Wildcards are literal

- **WHEN** the user filters by the text "100%"
- **THEN** only records whose document name contains "100%" SHALL be listed

#### Scenario: By date range

- **WHEN** the user filters from the start of 1 October to the start of 8 October
- **THEN** only records signed in that interval SHALL be listed, including one signed exactly at the start and excluding one signed exactly at the end

#### Scenario: Another user's certificate

- **WHEN** the filter names a certificate of another user
- **THEN** the system SHALL answer not found

#### Scenario: Inverted range

- **WHEN** the start instant is the same as or later than the end instant
- **THEN** the system SHALL reject the request with a bad-request error

### Requirement: Certificates of the signature log

The system SHALL list, for the caller, every certificate that at least one of their signature records was made with, including deleted ones, each with its id, alias, holder name and whether it is deleted, ordered by alias. Certificates never used to sign SHALL not be listed.

#### Scenario: Deleted certificate still offered

- **WHEN** the user signed with certificate X and then deleted it
- **THEN** X SHALL be listed, flagged as deleted

#### Scenario: Unused certificate not offered

- **WHEN** the user has a certificate they never signed with
- **THEN** it SHALL not be listed
