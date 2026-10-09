# Document Organization

## Purpose

Lets each signed-in user organize their document library: nest documents in folders, label them with colored tags, pin the ones that matter, act on several documents at once, and browse, search and filter the library by those means.

## Requirements

### Requirement: Folder tree

Each user SHALL own a tree of folders. A folder SHALL have a name and either a parent folder of the same user or no parent (a top-level folder in the library root). A document SHALL be in exactly one of the user's folders or in the library root. Folder names SHALL be trimmed, stripped of control characters and between 1 and 100 characters long. Two folders with the same parent (or both top-level) SHALL NOT have names that are equal ignoring case. A folder SHALL be at most 10 levels deep, top-level folders being level 1. Folders SHALL be private to their owner: any folder operation, and any document operation naming a folder, that names a folder that does not exist or belongs to another user SHALL answer not found and SHALL change nothing.

#### Scenario: Create a nested folder

- **WHEN** a user creates a folder named `Contratos` inside their folder `Clientes`
- **THEN** the system SHALL create the folder with `Clientes` as its parent and return it

#### Scenario: Duplicate sibling name

- **WHEN** a user creates or renames a folder so that it would share its name with a sibling, for example `contratos` next to an existing `Contratos`
- **THEN** the system SHALL answer a conflict error with a Spanish message and SHALL change nothing

#### Scenario: Too deep

- **WHEN** a user creates a folder inside a folder that is already 10 levels deep
- **THEN** the system SHALL answer a conflict error with a Spanish message and SHALL create nothing

#### Scenario: Another user's folder

- **WHEN** a user creates a folder inside, renames, moves, deletes or uploads into a folder of another user
- **THEN** the system SHALL answer not found and SHALL change nothing

### Requirement: List folders

The system SHALL return all the signed-in user's folders in one response, ordered by name, each with its id, name, parent id (null for top-level folders), the number of not-deleted documents directly inside it, and its creation and update dates.

#### Scenario: Counts only direct, live documents

- **WHEN** a folder holds two documents, one of them deleted, and a subfolder with three documents
- **THEN** the folder SHALL be listed with a document count of 1

### Requirement: Rename and move folders

The system SHALL let the owner rename a folder and move it under another of their folders or to the library root, keeping its contents. A folder SHALL NOT be moved into itself or into one of its descendants; such a move SHALL be rejected as a bad request. A move SHALL be rejected with a conflict error when the destination already holds a folder with the same name ignoring case, or when the moved folder or any of its descendants would end deeper than 10 levels.

#### Scenario: Move into a descendant

- **WHEN** a user moves folder `Clientes` into its own subfolder `Clientes/Contratos`
- **THEN** the system SHALL answer a bad-request error and the tree SHALL stay unchanged

#### Scenario: Move to the root

- **WHEN** a user moves `Clientes/Contratos` to the library root
- **THEN** `Contratos` SHALL become a top-level folder and SHALL keep its documents and subfolders

### Requirement: Delete a folder without deleting documents

The system SHALL let the owner delete a folder. Deleting a folder SHALL move its documents and its direct subfolders to the folder's parent (or to the library root for a top-level folder) and SHALL never delete a document. When a moved subfolder's name clashes with a folder already in the destination, the system SHALL rename the moved one by appending ` (2)`, ` (3)` and so on with the first number that is free. Deleting a folder SHALL also remove its icon.

#### Scenario: Contents move up

- **WHEN** a user deletes folder `Clientes/Antiguos`, which holds two documents and a subfolder `2024`
- **THEN** the two documents and `2024` SHALL now be inside `Clientes`, and `Antiguos` SHALL no longer exist

#### Scenario: Name clash on the way up

- **WHEN** the deleted folder holds a subfolder `2024` and its parent already holds a folder `2024`
- **THEN** the moved subfolder SHALL be named `2024 (2)`

### Requirement: Folder icons

Folders SHALL be an icon-capable entity type in the entity icon registry, so a folder can carry a user-chosen icon and color. Only the folder's owner SHALL read or change its icon. A folder without an icon SHALL be shown with a plain folder icon.

#### Scenario: Owner sets an icon

- **WHEN** the owner sets the icon `briefcase` in color `blue` on one of their folders
- **THEN** the folder SHALL be shown with that icon in that color wherever folders are displayed

#### Scenario: Another user's folder icon

- **WHEN** a user sets or clears the icon of a folder of another user
- **THEN** the system SHALL answer not found and SHALL store nothing

### Requirement: Tags

Each user SHALL own a set of tags, each with a name and a color. Tag names SHALL be trimmed, stripped of control characters and between 1 and 50 characters long, and two tags of the same user SHALL NOT have names that are equal ignoring case. The color SHALL be one of the entity icon palette keys and SHALL default to `neutral`. The system SHALL let the owner create, list, rename and recolor tags, and delete a tag, which SHALL remove it from every document that carried it. The tag list SHALL be ordered by name and SHALL give each tag the number of not-deleted documents that carry it. Tag operations naming a tag that does not exist or belongs to another user SHALL answer not found and SHALL change nothing.

#### Scenario: Duplicate tag name

- **WHEN** a user creates or renames a tag to `urgente` while they already have a tag `Urgente`
- **THEN** the system SHALL answer a conflict error with a Spanish message and SHALL change nothing

#### Scenario: Deleting a tag

- **WHEN** a user deletes a tag that three documents carry
- **THEN** the tag SHALL no longer exist and none of those documents SHALL carry it

#### Scenario: Invalid color

- **WHEN** a tag is created or updated with a color that is not a palette key
- **THEN** input validation SHALL reject the request and nothing SHALL be stored

### Requirement: Organize several documents at once

The system SHALL let the owner apply each of these operations to a list of 1 to 100 of their documents in one request:

- move them into one of their folders or to the library root;
- add some of their tags and remove others (at least one tag to add or remove, and no tag both added and removed); adding a tag a document already carries and removing one it does not carry SHALL leave it unchanged;
- pin or unpin them; pinning an already pinned document SHALL keep the moment it was first pinned;
- delete them, with the same effects as deleting each one.

Each operation SHALL be atomic: when any named document, folder or tag does not exist, is deleted or belongs to another user, the system SHALL answer not found and SHALL change none of the documents.

#### Scenario: Move a selection

- **WHEN** a user moves three of their documents into their folder `Facturas`
- **THEN** all three SHALL be in `Facturas`

#### Scenario: One foreign document spoils the batch

- **WHEN** a user tags four documents and one of them belongs to another user
- **THEN** the system SHALL answer not found and none of the four SHALL change

#### Scenario: Add and remove tags together

- **WHEN** a user adds tag `Revisado` and removes tag `Pendiente` on two documents, one of which does not carry `Pendiente`
- **THEN** both SHALL carry `Revisado` and neither SHALL carry `Pendiente`

### Requirement: Browse folders on the documents page

The `/documents` page SHALL show one folder of the library at a time, the root by default and the folder named by the `carpeta` query parameter otherwise, so the open folder survives reloads and can be linked. Above the content it SHALL show breadcrumbs from "Documentos" (the root) to the open folder, each segment linking to that folder. The open folder's subfolders SHALL be listed before its documents, in both the thumbnail and the list view, each with its icon, name and document count, and opening one SHALL navigate into it. The page SHALL let the user create a folder inside the open folder ("Nueva carpeta"), and rename, change the icon of, move and delete a folder from its actions; deleting SHALL ask for confirmation and explain that its documents and subfolders move to the parent folder. Uploading from the page SHALL put the new document in the open folder. A `carpeta` value that names no folder of the user SHALL show a "Carpeta no encontrada" state with a link back to the root. Documents SHALL be listed pinned first, then newest first. An empty folder SHALL say so and offer the upload and new-folder actions.

#### Scenario: Open a subfolder

- **WHEN** the user opens folder `Contratos` from the root
- **THEN** the URL SHALL carry `?carpeta=<id of Contratos>`, the breadcrumbs SHALL read "Documentos / Contratos" and only the documents and subfolders inside `Contratos` SHALL be listed

#### Scenario: Upload into the open folder

- **WHEN** the user uploads a PDF while `Contratos` is open
- **THEN** the new document SHALL appear in `Contratos` without reloading the page

#### Scenario: Unknown folder in the URL

- **WHEN** the user opens `/documents?carpeta=<id>` for a folder that was deleted
- **THEN** the page SHALL show "Carpeta no encontrada" with a link to the root of the library

### Requirement: Search and filter the library

The `/documents` page SHALL offer, through the shared list filters with removable chips, a search by document name (case-insensitive, contained text), a "Etiquetas" facet whose options are the user's tags with include and exclude, a "Estado" facet with the options "Firmado" and "Sin firmar", and a "Fijado" facet with the options "Fijado" and "No fijado". A document SHALL match the tag facet when it carries at least one included tag (or no tag is included) and none of the excluded ones. Facet options SHALL show how many documents would match each one given the other active filters. While any filter is active, the page SHALL list matching documents from the whole library instead of the open folder, SHALL hide the folder list, and SHALL show each document's folder path; clearing the filters SHALL return to the open folder.

#### Scenario: Search spans every folder

- **WHEN** the user, with the root open, searches for `nómina` and documents with that text in their name live in two different folders
- **THEN** both SHALL be listed, each with its folder path

#### Scenario: Exclude a tag

- **WHEN** the user includes tag `Clientes` and excludes tag `Archivado`
- **THEN** only documents carrying `Clientes` and not carrying `Archivado` SHALL be listed

#### Scenario: Back to the folder

- **WHEN** the user clears every filter
- **THEN** the page SHALL list the open folder's subfolders and documents again

### Requirement: Tags and pins on the documents page

Each document card and row on `/documents` SHALL show its tags as chips with the tag's color and name, at most three followed by "+N" when there are more, and a pinned mark when it is pinned. A document's actions SHALL include "Mover a…", "Etiquetas" and "Fijar" or "Quitar de fijados". "Etiquetas" SHALL open a picker listing the user's tags with checkboxes and SHALL let the user create a tag by typing a name that does not exist yet. The page SHALL offer a "Gestionar etiquetas" dialog listing every tag with its document count, to create, rename, recolor and delete tags; deleting SHALL ask for confirmation and say how many documents carry the tag. Tag colors SHALL be chosen from the palette swatches used by entity icons. All page text SHALL be in Spanish.

#### Scenario: Create a tag while tagging

- **WHEN** the user types `Proveedores` in a document's tag picker and no tag with that name exists
- **THEN** the picker SHALL offer to create it, and choosing that SHALL create the tag and add it to the document

#### Scenario: Many tags

- **WHEN** a document carries five tags
- **THEN** its card SHALL show three tag chips and "+2"

### Requirement: Select several documents

Every document card and row on `/documents` SHALL have a checkbox to select it, and the page SHALL offer to select every listed document. While at least one document is selected, a selection bar SHALL show "N seleccionados" and the actions "Mover a…", "Etiquetas", "Fijar", "Quitar de fijados", "Unir en un PDF" (only while at least two documents are selected) and "Eliminar", plus a control to clear the selection; on narrow viewports it SHALL take the place of the filter action bar. The actions SHALL apply to every selected document. "Etiquetas" over a selection SHALL show a tag checked when every selected document carries it and indeterminate when only some do, and SHALL change only the tags the user toggles. "Eliminar" SHALL ask for confirmation naming how many documents will be deleted. Changing the open folder or the filters SHALL clear the selection, and pressing Escape SHALL clear it too. Folders SHALL NOT be selectable.

#### Scenario: Tag a mixed selection

- **WHEN** two selected documents carry tag `Urgente`, a third does not, and the user opens "Etiquetas"
- **THEN** `Urgente` SHALL be shown indeterminate, and checking it SHALL add it to the third document without touching the other tags of any of them

#### Scenario: Bulk delete

- **WHEN** the user selects four documents, chooses "Eliminar" and confirms
- **THEN** the four documents SHALL disappear from the list and the selection SHALL be cleared

#### Scenario: Merge needs two documents

- **WHEN** exactly one document is selected
- **THEN** the selection bar SHALL not offer "Unir en un PDF"

### Requirement: Move with a dialog or by dragging

"Mover a…" SHALL open a dialog showing the user's folder tree with the library root at the top, where the user picks the destination; for documents the folder they are all already in SHALL be disabled, and for a folder the folder itself and its descendants SHALL be disabled. On devices with a fine pointer, the user SHALL also be able to drag a document, or the whole selection when the dragged document is selected, and drag a folder, onto a listed folder or onto a breadcrumb segment to move it there. A valid drop target SHALL be highlighted while dragged over; the folder being dragged, its descendants and the folder the dragged items are already in SHALL NOT accept the drop. Dragging files from outside the browser SHALL NOT be treated as a move.

#### Scenario: Drag a selection onto a folder

- **WHEN** the user selects three documents and drags one of them onto folder `Facturas`
- **THEN** all three documents SHALL be moved into `Facturas` and SHALL disappear from the open folder

#### Scenario: Drop onto a breadcrumb

- **WHEN** with `Clientes/Contratos` open the user drags a document onto the "Documentos" breadcrumb
- **THEN** the document SHALL be moved to the library root

#### Scenario: Invalid folder drop

- **WHEN** the user drags folder `Clientes` over one of its own subfolders
- **THEN** that subfolder SHALL NOT be highlighted and dropping there SHALL change nothing

### Requirement: Organization on the document page

The page of a document (`/documents/<id>`) SHALL show the folder path it lives in, each segment linking to that folder on `/documents`, and its tags, and SHALL offer "Mover a…", "Etiquetas" and pinning or unpinning with the same dialogs and picker as the documents page.

#### Scenario: Back to the folder

- **WHEN** the user opens a document that lives in `Clientes/Contratos` and selects the `Contratos` segment of its folder path
- **THEN** the browser SHALL open `/documents?carpeta=<id of Contratos>`
