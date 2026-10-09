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

Each document SHALL keep an ordered list of versions, numbered from 1. Version 1 SHALL be the upload, or the merged result for a document created by merging; each signature and each page edit SHALL add the next version, numbered one above the highest number the document ever had, so the number of a deleted version is never reused. Each version SHALL record its origin: upload, merge, signature or page edit, and the API SHALL return it with the version. A version SHALL never change once stored, except for being marked deleted as "Delete the latest version" describes. A deleted version SHALL NOT be part of the document's versions: it SHALL NOT be listed, counted, viewed, downloaded, checked, signed, edited or merged. The document's current version SHALL be its highest-numbered live version.

#### Scenario: Versions after two signatures

- **WHEN** a document has been signed twice after its upload
- **THEN** it SHALL have versions 1, 2 and 3, and version 3 SHALL be its current version

#### Scenario: Origin of each version

- **WHEN** a document is uploaded, has its pages edited and is then signed
- **THEN** its versions 1, 2 and 3 SHALL have the origins upload, page edit and signature

#### Scenario: Numbers are not reused

- **WHEN** the owner deletes version 3 of a document and then signs it
- **THEN** the new version SHALL be version 4, and the document's versions SHALL be 1, 2 and 4

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

The system SHALL list the signed-in user's documents that are not deleted, pinned documents first (most recently pinned first) and then the rest newest first, each with its name, page count, size of the current version, number of live versions, number of signatures on live versions, upload date, last signature date on a live version, the folder it is in (null for the library root), the ids of the tags it carries and the moment it was pinned (null when not pinned). The system SHALL return one document with the same fields plus its live versions and all its signature records, each saying whether its version has been deleted. A document that does not exist, is deleted or belongs to another user SHALL answer not found.

#### Scenario: Pinned first

- **WHEN** a user has three documents and pins the oldest one
- **THEN** the list SHALL return the pinned one first and the other two newest first

#### Scenario: Another user's document

- **WHEN** a user requests, downloads, signs, deletes, moves, tags or pins a document uploaded by another user
- **THEN** the system SHALL answer not found and SHALL change nothing

#### Scenario: After deleting a signed version

- **WHEN** a document signed once has its signed version 2 deleted
- **THEN** the list SHALL show it with 1 version, 0 signatures and no last signature date, and reading it SHALL return version 1 and the signature record marked as belonging to a deleted version

### Requirement: Download a version

The system SHALL let the owner download the current version of a document or any earlier live version, as a PDF file named after the document, with the version number in the name for earlier versions. A deleted version SHALL answer not found. The system SHALL offer two ways to obtain those bytes: a safe read, used to render documents, thumbnails and the version chosen on the document page, that SHALL NOT record anything; and an explicit download, used when the user saves the file, that returns the same file and records a "downloaded" trace for that version as the `activity-traces` capability describes. The frontend's download actions SHALL use the explicit download.

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

#### Scenario: Deleted version

- **WHEN** the owner requests version 3 of a document after deleting it
- **THEN** the system SHALL answer not found

### Requirement: Delete a document

The system SHALL let the owner delete one document, or several in one request. Deleting SHALL irreversibly destroy each document's data key, SHALL remove its stored objects (a failure to remove them SHALL NOT fail the deletion, since they can no longer be decrypted), SHALL remove its tags and its pin, SHALL hide it from every listing, count and read, and SHALL keep its name and its signature records. Deleting several documents SHALL be all-or-nothing in the database: when any of them does not exist, is already deleted or belongs to another user, none SHALL be deleted.

#### Scenario: Delete

- **WHEN** the owner deletes a document
- **THEN** it SHALL no longer be listed, read or downloadable, and its signature records SHALL still name it

#### Scenario: Delete several

- **WHEN** the owner deletes three of their documents in one request
- **THEN** none of the three SHALL be listed, and the folders and tags that held them SHALL no longer count them

### Requirement: Delete the latest version

The system SHALL let the owner delete the current version of one of their documents when the document has more than one live version, naming the version they saw as current. Deleting SHALL be a soft delete: the version SHALL be marked deleted with the moment of deletion and SHALL be kept as a record, so the traces and signature records that name it survive; its stored object SHALL be removed (a failure to remove it SHALL NOT fail the deletion, and SHALL leave the object unreachable through the API); the previous live version SHALL become the current version again; and the document's page count SHALL become that version's page count. A version produced by a signature SHALL be deletable like any other, and its signature record SHALL be kept. The deletion SHALL record a "document version deleted" trace in the same transaction, as the `activity-traces` capability describes. The system SHALL answer conflict, changing nothing, when the named version is no longer the current version, and when it is the document's only live version. A document that does not exist, is deleted or belongs to another user SHALL answer not found.

#### Scenario: Undo a signature

- **WHEN** the owner deletes version 3 of a document whose version 3 was produced by a signature
- **THEN** version 2 SHALL be the current version, version 3 SHALL no longer be listed, viewed or downloaded, and the signature record that produced version 3 SHALL still exist

#### Scenario: Undo a page edit

- **WHEN** the owner deletes version 2 of a 3-page document whose version 2 removed a page
- **THEN** version 1 SHALL be the current version and the document SHALL have 3 pages again

#### Scenario: Only version

- **WHEN** the owner tries to delete version 1 of a document that has no other live version
- **THEN** the system SHALL answer conflict and SHALL change nothing

#### Scenario: No longer current

- **WHEN** the owner deletes version 2 after another tab signed the document and stored version 3
- **THEN** the system SHALL answer conflict and SHALL change nothing

#### Scenario: Deleting twice in a row

- **WHEN** the owner deletes version 3 and then version 2 of a document with three versions
- **THEN** version 1 SHALL be the current version and two "document version deleted" traces SHALL be recorded

### Requirement: Documents pages

The frontend SHALL offer signed-in users a "Documentos" page at `/documents`, reachable from the navigation and the surface search. The page SHALL browse their folders and list the documents of the open folder, and let them upload a PDF, open a document, download its current version, rename it and delete it after confirming, as well as organize documents as the `document-organization` capability describes and edit or merge pages as the `page-editing` capability describes. Each document SHALL open at `/documents/<id>`, a page that renders the PDF's pages, shows the versions labelled by their origin ("original", "unión de documentos", "firmada", "páginas editadas"), the signature records, the folder path and the tags, lets the user download any version, and lets them view any version and delete the latest one as "Versions on the document page" describes. All page text SHALL be in Spanish.

#### Scenario: Upload from the list

- **WHEN** the user chooses a PDF in the upload dialog and confirms
- **THEN** the new document SHALL appear in the open folder without reloading the page

#### Scenario: Upload error is shown

- **WHEN** an upload fails, for example because the PDF is password-protected
- **THEN** the dialog SHALL stay open and SHALL show the Spanish error message returned by the API

#### Scenario: Empty library

- **WHEN** a user with no documents and no folders opens `/documents`
- **THEN** the page SHALL explain that there are no documents yet and SHALL offer the upload and new-folder actions

### Requirement: Versions on the document page

The document page SHALL let the owner choose any version in "Versiones" to view it in place of the current one. The chosen version SHALL be marked in the list, SHALL be kept in the page address as `?version=<number>` so it survives a reload and can be shared, and SHALL be rendered by the page's viewer with a notice naming it ("Estás viendo la versión 2 · firmada") and a "Ver la actual" action that returns to the current version. While an earlier version is shown, the hero's download action SHALL download that version and the "Validez de las firmas" panel SHALL check that version. Starting to sign or to edit pages SHALL return the viewer to the current version first, since both act on it. A `?version=` that names no live version SHALL show the current version. Viewing a version SHALL use the safe read and SHALL NOT record a trace.

The current version's entry SHALL offer "Eliminar versión" when the document has more than one live version. It SHALL ask for confirmation in a dialog that names the version and the version that becomes current again, and, when the version was produced by a signature, warns that the signed file will be deleted while the signature record and its trace are kept. After deleting, the page SHALL show the new current version, its page count and signatures without reloading. When the deletion fails, the dialog SHALL stay open and show the Spanish error message returned by the API. All text SHALL be in Spanish.

#### Scenario: View an earlier version

- **WHEN** the owner of a document with three versions chooses version 1 in "Versiones"
- **THEN** the viewer SHALL render version 1, the page address SHALL carry `?version=1`, and the page SHALL say that version 1 is shown

#### Scenario: Back to the current version

- **WHEN** the owner is viewing version 1 and chooses "Ver la actual"
- **THEN** the viewer SHALL render the current version and the page address SHALL no longer carry `version`

#### Scenario: Signing from an earlier version

- **WHEN** the owner is viewing version 1 of a document whose current version is 3 and chooses "Firmar"
- **THEN** the viewer SHALL render version 3 before the stamp is placed

#### Scenario: Viewing leaves no trace

- **WHEN** the owner views versions 1 and 2 of a document
- **THEN** no trace SHALL be recorded

#### Scenario: Delete the current version from the list

- **WHEN** the owner chooses "Eliminar versión" on version 3 and confirms
- **THEN** version 3 SHALL disappear from "Versiones" and the viewer SHALL render version 2

#### Scenario: Earlier versions cannot be deleted

- **WHEN** the owner looks at the entries of versions other than the current one
- **THEN** none of them SHALL offer "Eliminar versión"
