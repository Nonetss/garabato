## MODIFIED Requirements

### Requirement: Record traces of certificate and document actions

The system SHALL record one trace for each successful action of the following types, attributed to the user who performed it: certificate imported, certificate renamed, certificate password remembered, certificate password forgotten, certificate deleted, certificate used to sign in; document uploaded, documents merged, document pages edited, document downloaded, document renamed, document moved, document version deleted, document deleted. Each trace SHALL carry its type, the moment it happened, the client IP address when the request carried one, the certificate it concerns (certificate types) or the document it concerns (document types), and, when the action produced, delivered or deleted a version, that version. A trace SHALL be written in the same transaction as the action it records, so the action never takes effect without its trace and a failed action leaves no trace. Traces SHALL never be updated or deleted by the API; they SHALL only disappear when their user is deleted. Failed or refused actions (wrong password, not found, validation errors, conflicts) SHALL NOT be traced.

Each type SHALL also keep the details the trail needs even after names change, folders disappear or versions are deleted: a certificate rename keeps the previous and the new alias; a document rename keeps the previous and the new name; a move keeps the origin and the destination folder, each as its id and name or as the library root; a merge is recorded on the new document, with its first version, and keeps the id and name of each source document in merge order; a pages edit, a download and a version deletion keep the version number; a certificate used to sign in keeps the id and name of the token key whose module asked for the signature.

#### Scenario: Importing a certificate

- **WHEN** a user imports a certificate from a client at `203.0.113.7`
- **THEN** a "certificate imported" trace SHALL be recorded for that certificate with the import time and the IP `203.0.113.7`

#### Scenario: Signing in to a site with the browser token

- **WHEN** the browser token of a user signs a TLS handshake with certificate X through the token key "Firefox portátil", from a client at `192.168.1.20`
- **THEN** a "certificate used to sign in" trace SHALL be recorded for X with the IP `192.168.1.20`, keeping the token key's id and the name "Firefox portátil"

#### Scenario: A refused token signature leaves no trace

- **WHEN** the browser token asks to sign while the user's signing window is closed
- **THEN** no trace SHALL be recorded

#### Scenario: A failed import leaves no trace

- **WHEN** a user tries to import a PKCS#12 file with the wrong password
- **THEN** no trace SHALL be recorded

#### Scenario: Renaming keeps both names

- **WHEN** a user renames the document "borrador.pdf" to "contrato.pdf"
- **THEN** a "document renamed" trace SHALL be recorded keeping "borrador.pdf" as the previous name and "contrato.pdf" as the new one

#### Scenario: A rename that changes nothing

- **WHEN** a user renames a certificate to the alias it already has
- **THEN** no trace SHALL be recorded

#### Scenario: Moving several documents

- **WHEN** a user moves three documents from the folder "2025" to the library root, and one of them was already at the root
- **THEN** two "document moved" traces SHALL be recorded, one per document that changed folder, each keeping "2025" as the origin and the root as the destination

#### Scenario: Deleting several documents

- **WHEN** a user deletes two documents in one action
- **THEN** one "document deleted" trace SHALL be recorded for each of them

#### Scenario: Merging documents

- **WHEN** a user merges "a.pdf" and "b.pdf" into "ab.pdf"
- **THEN** a "documents merged" trace SHALL be recorded for "ab.pdf" and its version 1, keeping "a.pdf" and "b.pdf" in that order as its sources

#### Scenario: Editing pages

- **WHEN** a user edits the pages of a document whose current version is 2
- **THEN** a "document pages edited" trace SHALL be recorded with the new version 3

#### Scenario: Deleting the latest version

- **WHEN** a user deletes version 3 of a document
- **THEN** a "document version deleted" trace SHALL be recorded for that document with version 3

#### Scenario: Earlier traces survive a version deletion

- **WHEN** a user downloads version 3 of a document and then deletes version 3
- **THEN** the "document downloaded" trace SHALL still be listed with version 3

#### Scenario: A refused version deletion leaves no trace

- **WHEN** a user tries to delete the only version of a document
- **THEN** no trace SHALL be recorded

#### Scenario: The action fails after the trace is written

- **WHEN** the database rejects a document rename after its trace has been inserted in the same transaction
- **THEN** neither the rename nor the trace SHALL be stored

### Requirement: Traces page

The frontend SHALL offer signed-in users a "Trazas" page at `/traces`, reachable from the navbar in the place "Firmas" had and from the surface search, that lists their trail newest first as a timeline grouped by recency ("Hoy", "Esta semana", "Este mes"…) and loads further entries as the user scrolls. Each entry SHALL show an icon and a Spanish label for its type ("Certificado importado", "Certificado renombrado", "Contraseña recordada", "Contraseña olvidada", "Certificado eliminado", "Acceso con certificado", "Documento subido", "Documentos unidos", "Páginas editadas", "Documento firmado", "Documento descargado", "Documento renombrado", "Documento movido", "Versión eliminada", "Documento eliminado"), the document name or certificate alias it concerns, how long ago it happened ("hace 20 horas", "ayer") and its exact date and time with the client IP when recorded, and one sentence on what happened (the version, the previous and new name, the origin and destination folder, the merged documents, the browser that used the certificate to sign in, or, for a signature, the certificate, the version and whether it is invisible or visible on which pages). Deleted documents and certificates SHALL be marked "eliminado", and a version that has been deleted SHALL be marked "eliminada" wherever the entry names it. The page hero SHALL show the total number of entries that match the filters. All text SHALL be in Spanish. `/signatures` SHALL no longer exist.

#### Scenario: Open the trail

- **WHEN** a user who imported a certificate and then signed two documents opens `/traces`
- **THEN** the page SHALL list the two signatures and then the import, the most recent first

#### Scenario: A sign-in with the browser token

- **WHEN** a user whose browser token signed in to a site with the certificate "FNMT personal" through the token key "Firefox portátil" opens `/traces`
- **THEN** the page SHALL list an "Acceso con certificado" entry for "FNMT personal" saying that "Firefox portátil" used it to sign in

#### Scenario: A version deletion

- **WHEN** a user who deleted version 3 of "contrato.pdf" opens `/traces`
- **THEN** the page SHALL list a "Versión eliminada" entry for "contrato.pdf" saying that version 3 was deleted

#### Scenario: Nothing traced yet

- **WHEN** a user with no entries opens `/traces`
- **THEN** the page SHALL say that there is no activity yet and SHALL link to `/documents`

#### Scenario: No match

- **WHEN** the active filters match no entries
- **THEN** the page SHALL say that no trace matches the filters and offer to clear them

#### Scenario: The old path is gone

- **WHEN** a user opens `/signatures`
- **THEN** the app SHALL answer with its not-found page

### Requirement: Trace detail

Choosing a row SHALL open a detail panel for that entry without leaving the page. A "Documento firmado" entry SHALL show the full signature detail: the document name, linked to `/documents/[id]` unless the document is deleted; the version number, marked "eliminada" when that version has been deleted; the signing date and time with seconds; invisible, or visible with its pages; the reason and location when present; the SHA-256 before and after signing and the certificate fingerprint, each copyable; the client IP when recorded; the timestamp as "Sello de tiempo" with the time the TSA asserted, with seconds, and the TSA's name, or "Sin sello de tiempo" when the signature carries none; and the certificate's alias, holder, tax identifier, issuer, serial number and validity period, marked "eliminado" when deleted. Any other entry SHALL show its type, the date and time with seconds, the client IP when recorded, the document linked to `/documents/[id]` unless deleted, or the certificate with its alias and holder, marked "eliminado" when deleted, the version when it has one, marked "eliminada" when it has been deleted, and its details: the previous and new name or alias, the origin and destination folder ("Biblioteca" for the root), or the merged documents in order, or the token key name for a sign-in with the browser token.

#### Scenario: Detail of a visible signature

- **WHEN** the user opens a signature entry signed visibly on pages 1 and 3 with a reason
- **THEN** the panel SHALL show "Visible en páginas 1, 3", the reason, both hashes and the certificate data

#### Scenario: Detail of a timestamped signature

- **WHEN** the user opens a signature entry whose signature carries a timestamp from `FreeTSA`
- **THEN** the panel SHALL show "Sello de tiempo" with the TSA's time and `FreeTSA`

#### Scenario: Detail of a move

- **WHEN** the user opens a "Documento movido" entry from "2025" to the root
- **THEN** the panel SHALL show "2025" as origin and "Biblioteca" as destination

#### Scenario: Detail of a sign-in with the browser token

- **WHEN** the user opens an "Acceso con certificado" entry made through the token key "Firefox portátil"
- **THEN** the panel SHALL show the certificate with its alias and holder, the date and time with seconds, the client IP and "Firefox portátil" as the browser

#### Scenario: Deleted document

- **WHEN** the user opens an entry whose document has been deleted
- **THEN** the panel SHALL show the document name marked "eliminado" and SHALL not link to it

#### Scenario: Signature of a deleted version

- **WHEN** the user opens a signature entry whose version 2 has since been deleted
- **THEN** the panel SHALL show version 2 marked "eliminada" and keep every other field of the signature
