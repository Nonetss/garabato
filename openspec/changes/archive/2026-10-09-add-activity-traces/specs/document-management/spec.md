## MODIFIED Requirements

### Requirement: Download a version

The system SHALL let the owner download the current version of a document or any earlier version, as a PDF file named after the document, with the version number in the name for earlier versions. The system SHALL offer two ways to obtain those bytes: a safe read, used to render documents and thumbnails, that SHALL NOT record anything; and an explicit download, used when the user saves the file, that returns the same file and records a "downloaded" trace for that version as the `activity-traces` capability describes. The frontend's download actions SHALL use the explicit download.

#### Scenario: Download the signed version

- **WHEN** the owner downloads a document that was signed once
- **THEN** the file SHALL be version 2, the signed PDF

#### Scenario: Download the original

- **WHEN** the owner downloads version 1 of a signed document
- **THEN** the file SHALL be byte-for-byte the uploaded PDF

#### Scenario: Viewing is not traced

- **WHEN** the owner opens a document and its pages and thumbnail are rendered
- **THEN** no "downloaded" trace SHALL be recorded

#### Scenario: Saving the file is traced

- **WHEN** the owner chooses "Descargar" on version 1 of a document
- **THEN** the browser SHALL save version 1 and the owner's traces SHALL contain a "downloaded" trace naming the document and version 1
