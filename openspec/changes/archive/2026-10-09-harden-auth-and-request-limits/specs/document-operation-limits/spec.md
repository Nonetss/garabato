## ADDED Requirements

### Requirement: Per-user limit on heavy document operations

The procedures that parse, decrypt, sign or rewrite whole PDFs in memory — `v1.document.upload`, `v1.document.sign`, `v1.document.editPages`, `v1.document.merge` and `v1.document.verifySignatures` — SHALL share one per-user limit: at most 2 of them running at the same time for the same user, and at most 30 started by the same user in any 60-second window. A call beyond either bound SHALL be refused with `TOO_MANY_REQUESTS` (HTTP `429`) and a Spanish message, before the procedure reads, parses or decrypts any document. A refused call SHALL NOT count towards the window. A call SHALL release its concurrency slot when it finishes, whether it succeeds or fails. The limit SHALL be held in the backend process's memory and SHALL NOT apply to other procedures, including `v1.document.download`.

#### Scenario: Calls within the limits

- **WHEN** a user runs one upload and one signature at the same time
- **THEN** both SHALL run normally

#### Scenario: Too many at once

- **WHEN** a user already has 2 heavy document operations running and starts a third
- **THEN** the third call SHALL be refused with `429` and a Spanish message, and SHALL NOT read the document

#### Scenario: Slot freed after a failure

- **WHEN** one of a user's 2 running operations fails with an error
- **THEN** the user SHALL be able to start another heavy operation immediately

#### Scenario: Too many in a minute

- **WHEN** a user has started 30 heavy document operations in the last 60 seconds, all already finished, and starts another
- **THEN** the call SHALL be refused with `429` until the oldest of those starts is more than 60 seconds old

#### Scenario: Limits are per user

- **WHEN** one user has reached either bound and a different user starts a heavy document operation
- **THEN** the other user's call SHALL run normally

#### Scenario: Downloads are not limited

- **WHEN** a user at the concurrency bound opens the library and its thumbnails download several documents
- **THEN** `v1.document.download` SHALL serve them normally

#### Scenario: The frontend shows the refusal

- **WHEN** a heavy operation started from the UI is refused with `429`
- **THEN** the UI SHALL show the API's Spanish message in its usual error toast or inline error
