## MODIFIED Requirements

### Requirement: Versioned documents

Each document SHALL keep an ordered list of versions, numbered from 1. Version 1 SHALL be the upload, or the merged result for a document created by merging; each signature and each page edit SHALL add the next version. Each version SHALL record its origin: upload, merge, signature or page edit, and the API SHALL return it with the version. A version SHALL never change once stored. The document's current version SHALL be its highest-numbered one.

#### Scenario: Versions after two signatures

- **WHEN** a document has been signed twice after its upload
- **THEN** it SHALL have versions 1, 2 and 3, and version 3 SHALL be its current version

#### Scenario: Origin of each version

- **WHEN** a document is uploaded, has its pages edited and is then signed
- **THEN** its versions 1, 2 and 3 SHALL have the origins upload, page edit and signature

### Requirement: Documents pages

The frontend SHALL offer signed-in users a "Documentos" page at `/documents`, reachable from the navigation and the surface search. The page SHALL browse their folders and list the documents of the open folder, and let them upload a PDF, open a document, download its current version, rename it and delete it after confirming, as well as organize documents as the `document-organization` capability describes and edit or merge pages as the `page-editing` capability describes. Each document SHALL open at `/documents/<id>`, a page that renders the PDF's pages, shows the versions labelled by their origin ("original", "unión de documentos", "firmada", "páginas editadas"), the signature records, the folder path and the tags, and lets the user download any version. All page text SHALL be in Spanish.

#### Scenario: Upload from the list

- **WHEN** the user chooses a PDF in the upload dialog and confirms
- **THEN** the new document SHALL appear in the open folder without reloading the page

#### Scenario: Upload error is shown

- **WHEN** an upload fails, for example because the PDF is password-protected
- **THEN** the dialog SHALL stay open and SHALL show the Spanish error message returned by the API

#### Scenario: Empty library

- **WHEN** a user with no documents and no folders opens `/documents`
- **THEN** the page SHALL explain that there are no documents yet and SHALL offer the upload and new-folder actions
