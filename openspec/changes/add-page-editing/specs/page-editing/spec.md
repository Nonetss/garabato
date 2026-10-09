## ADDED Requirements

### Requirement: Edit the pages of a document

The system SHALL let the owner of a document produce a new version from its current version by giving the resulting list of pages: each entry SHALL name a 0-based page of the current version and a rotation of 0, 90, 180 or 270 degrees added clockwise to that page's rotation. Pages left out SHALL be removed. The request SHALL name the version the user was editing, SHALL keep at least one page and SHALL NOT name a page twice or a page the version does not have. The new version SHALL be stored as the document's next version with origin "page edit", and the document's page count SHALL become the new number of pages. The document's name, folder, tags and pin SHALL be kept. A request that changes nothing SHALL be rejected with a bad-request error.

#### Scenario: Reorder and rotate

- **WHEN** the owner of a 3-page document sends pages `[2, 0 rotated 90, 1]`
- **THEN** the new current version SHALL show the former page 3 first, then the former page 1 rotated a quarter turn clockwise, then the former page 2

#### Scenario: Remove a page

- **WHEN** the owner of a 4-page document sends pages `[0, 1, 3]`
- **THEN** the new version SHALL have 3 pages and the document's page count SHALL be 3

#### Scenario: No pages left

- **WHEN** the request sends an empty page list
- **THEN** the system SHALL reject it with a bad-request error and SHALL store nothing

#### Scenario: Document changed meanwhile

- **WHEN** the version named in the request is no longer the document's current version
- **THEN** the system SHALL reject the request with a conflict error telling the user to reload, and SHALL store nothing

#### Scenario: Earlier versions kept

- **WHEN** the owner edits the pages of a document
- **THEN** every earlier version SHALL remain downloadable unchanged

### Requirement: Merge documents

The system SHALL let a user create a new document from 2 to 20 of their documents, in the order given, holding every page of each document's current version with its rotation. The request SHALL give the new document's name, which SHALL be normalized as uploaded names are (ending in `.pdf`), and optionally one of the user's folders (the library root when none is given). The new document SHALL start with a first version of origin "merge" and SHALL be stored encrypted like an upload. The source documents SHALL be left unchanged. Naming a document twice, a document that does not exist, is deleted or belongs to another user SHALL be rejected (not found for documents the user cannot see) and nothing SHALL be stored. A result larger than 20 MiB SHALL be rejected with a bad-request error.

#### Scenario: Contract and annexes

- **WHEN** a user merges `contrato.pdf` (3 pages) and `anexo.pdf` (2 pages), in that order, naming the result `contrato completo`
- **THEN** a new document `contrato completo.pdf` with 5 pages SHALL exist, its first three pages from `contrato.pdf`, and both sources SHALL be unchanged

#### Scenario: Too large

- **WHEN** the merged PDF would exceed 20 MiB
- **THEN** the system SHALL reject the request with a bad-request error in Spanish and SHALL store nothing

#### Scenario: Another user's document

- **WHEN** the list includes a document of another user
- **THEN** the system SHALL answer not found and SHALL store nothing

### Requirement: Signed documents cannot be rewritten

Editing pages and merging SHALL refuse any document that has signature records in the platform or whose current version embeds a signature field holding a signature, with a conflict error whose Spanish message explains that rewriting the document would invalidate its signatures. For a merge, the message SHALL name the first signed document.

#### Scenario: Edit a signed document

- **WHEN** the owner tries to edit the pages of a document they signed
- **THEN** the system SHALL reject the request with a conflict error and SHALL store nothing

#### Scenario: Merge an externally signed upload

- **WHEN** a merge includes a document uploaded with a signature made elsewhere
- **THEN** the system SHALL reject the request with a conflict error naming that document and SHALL store nothing

### Requirement: Page editor on the document page

The document page SHALL offer "Editar páginas", which opens an editor showing a thumbnail of every page of the current version with its number. The user SHALL be able to reorder pages by dragging them or with keyboard-operable move controls, rotate a page left or right, and remove or restore a page; a summary SHALL show the resulting page count and how many pages were removed or rotated. "Guardar" SHALL store the result as a new version and show it without reloading; "Cancelar" SHALL discard the changes. "Guardar" SHALL be disabled while nothing changed or when every page is removed. When the document has signatures, "Editar páginas" SHALL be disabled with a hint explaining why. All text SHALL be in Spanish.

#### Scenario: Save an edit

- **WHEN** the user moves page 3 to the first position in the editor and chooses "Guardar"
- **THEN** the page SHALL show the new version, with the former page 3 first, and the version list SHALL show it as "páginas editadas"

#### Scenario: Signed document

- **WHEN** the user opens a document that has a signature
- **THEN** "Editar páginas" SHALL be disabled and its hint SHALL explain that editing would invalidate the signatures

#### Scenario: Error is shown

- **WHEN** saving fails, for example because the document changed meanwhile
- **THEN** the editor SHALL stay open, keep the user's changes and show the Spanish error message returned by the API

### Requirement: Merge dialog on the documents page

Choosing "Unir en un PDF" on the documents page SHALL open a dialog listing the selected documents in their listed order, letting the user reorder them by dragging or with keyboard-operable move controls, and asking for the new document's name, prefilled from the first document's name. Confirming SHALL create the document in the open folder (the library root while the page shows filtered results), clear the selection and open the new document's page. All text SHALL be in Spanish.

#### Scenario: Merge two documents

- **WHEN** the user selects two documents in folder `Contratos`, chooses "Unir en un PDF", puts the second first and confirms
- **THEN** a new document SHALL be created in `Contratos` with the second document's pages first, and the browser SHALL open its page

#### Scenario: Merge error is shown

- **WHEN** the merge fails, for example because one document is signed
- **THEN** the dialog SHALL stay open and show the Spanish error message naming that document
