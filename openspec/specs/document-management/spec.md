# Document Management

## Purpose

Lets each signed-in user keep a personal library of PDF documents in the platform, stored encrypted in object storage with every version they go through, so they can sign them, download any version and delete them.

## Requirements

### Requirement: Upload a PDF document

The system SHALL let a signed-in user upload a PDF file of at most 20 MiB, optionally into one of their folders. The system SHALL accept it only when it parses as a PDF document with at least one page and is not encrypted or password-protected. The new document SHALL belong to the uploader, SHALL be named after the uploaded file name (keeping a `.pdf` extension), SHALL be placed in the given folder or, when none is given, in the library root, and SHALL start with a first version holding the uploaded bytes unchanged. The response SHALL return the document with its page count, size and SHA-256 hash.

#### Scenario: Successful upload

- **WHEN** a signed-in user uploads a valid 3-page PDF named `contrato.pdf`
- **THEN** the system SHALL create a document named `contrato.pdf` owned by that user, in the library root, with 3 pages and one version whose bytes equal the upload

#### Scenario: Upload into a folder

- **WHEN** a signed-in user uploads a valid PDF naming their folder `Contratos` as destination
- **THEN** the new document SHALL be in `Contratos`

#### Scenario: Upload into another user's folder

- **WHEN** the destination folder does not exist or belongs to another user
- **THEN** the system SHALL answer not found and SHALL store nothing

#### Scenario: Not a PDF

- **WHEN** the uploaded file does not parse as a PDF
- **THEN** the system SHALL reject it with a bad-request error and SHALL store nothing

#### Scenario: Password-protected PDF

- **WHEN** the uploaded PDF is encrypted
- **THEN** the system SHALL reject it with a bad-request error whose Spanish message asks for an unprotected PDF, and SHALL store nothing

#### Scenario: Too large

- **WHEN** the uploaded file is larger than 20 MiB
- **THEN** the system SHALL reject it and SHALL store nothing

#### Scenario: Already signed PDF

- **WHEN** the uploaded PDF already carries signatures made elsewhere
- **THEN** the system SHALL accept it unchanged, so those signatures remain intact

### Requirement: Versioned documents

Each document SHALL keep an ordered list of versions, numbered from 1. Version 1 SHALL be the upload; each signature SHALL add the next version. A version SHALL never change once stored. The document's current version SHALL be its highest-numbered one.

#### Scenario: Versions after two signatures

- **WHEN** a document has been signed twice after its upload
- **THEN** it SHALL have versions 1, 2 and 3, and version 3 SHALL be its current version

### Requirement: Encrypted object storage

The system SHALL store every version's bytes in the configured S3-compatible object store, encrypted with authenticated encryption under a key unique to the document, itself encrypted with the server master key, and bound to the document and version it belongs to. The object store SHALL never receive a document's plaintext. Downloads SHALL go through the API, which decrypts the version for the caller.

#### Scenario: Bucket contents

- **WHEN** the objects in the bucket are read directly
- **THEN** none of them SHALL contain the plaintext of any uploaded or signed PDF

#### Scenario: Object copied to another version

- **WHEN** a stored object is copied over another version's object and that version is downloaded
- **THEN** the download SHALL fail instead of returning the other version's content

#### Scenario: Storage unavailable

- **WHEN** the object store cannot be reached during an upload, a download or a signature
- **THEN** the request SHALL fail with a service-unavailable or bad-gateway error and SHALL leave no database row pointing at a missing object

### Requirement: List and read documents

The system SHALL list the signed-in user's documents that are not deleted, pinned documents first (most recently pinned first) and then the rest newest first, each with its name, page count, size of the current version, number of versions, number of signatures, upload date, last signature date, the folder it is in (null for the library root), the ids of the tags it carries and the moment it was pinned (null when not pinned). The system SHALL return one document with the same fields plus its versions and its signature records. A document that does not exist, is deleted or belongs to another user SHALL answer not found.

#### Scenario: Pinned first

- **WHEN** a user has three documents and pins the oldest one
- **THEN** the list SHALL return the pinned one first and the other two newest first

#### Scenario: Another user's document

- **WHEN** a user requests, downloads, signs, deletes, moves, tags or pins a document uploaded by another user
- **THEN** the system SHALL answer not found and SHALL change nothing

### Requirement: Download a version

The system SHALL let the owner download the current version of a document or any earlier version, as a PDF file named after the document, with the version number in the name for earlier versions.

#### Scenario: Download the signed version

- **WHEN** the owner downloads a document that was signed once
- **THEN** the file SHALL be version 2, the signed PDF

#### Scenario: Download the original

- **WHEN** the owner downloads version 1 of a signed document
- **THEN** the file SHALL be byte-for-byte the uploaded PDF

### Requirement: Delete a document

The system SHALL let the owner delete one document, or several in one request. Deleting SHALL irreversibly destroy each document's data key, SHALL remove its stored objects (a failure to remove them SHALL NOT fail the deletion, since they can no longer be decrypted), SHALL remove its tags and its pin, SHALL hide it from every listing, count and read, and SHALL keep its name and its signature records. Deleting several documents SHALL be all-or-nothing in the database: when any of them does not exist, is already deleted or belongs to another user, none SHALL be deleted.

#### Scenario: Delete

- **WHEN** the owner deletes a document
- **THEN** it SHALL no longer be listed, read or downloadable, and its signature records SHALL still name it

#### Scenario: Delete several

- **WHEN** the owner deletes three of their documents in one request
- **THEN** none of the three SHALL be listed, and the folders and tags that held them SHALL no longer count them

### Requirement: Documents pages

The frontend SHALL offer signed-in users a "Documentos" page at `/documents`, reachable from the navigation and the surface search. The page SHALL browse their folders and list the documents of the open folder, and let them upload a PDF, open a document, download its current version, rename it and delete it after confirming, as well as organize documents as the `document-organization` capability describes. Each document SHALL open at `/documents/<id>`, a page that renders the PDF's pages, shows the versions, the signature records, the folder path and the tags, and lets the user download any version. All page text SHALL be in Spanish.

#### Scenario: Upload from the list

- **WHEN** the user chooses a PDF in the upload dialog and confirms
- **THEN** the new document SHALL appear in the open folder without reloading the page

#### Scenario: Upload error is shown

- **WHEN** an upload fails, for example because the PDF is password-protected
- **THEN** the dialog SHALL stay open and SHALL show the Spanish error message returned by the API

#### Scenario: Empty library

- **WHEN** a user with no documents and no folders opens `/documents`
- **THEN** the page SHALL explain that there are no documents yet and SHALL offer the upload and new-folder actions
