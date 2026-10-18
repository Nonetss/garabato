# Activity Traces

## Purpose

Gives each user one chronological trail of what they did with their certificates and documents (imports, renames, remembered and forgotten passwords, deletions, uploads, merges, page edits, downloads, moves and signatures), recorded atomically with each action, so they can find what happened, when and from where, and read each entry's detail on the "Trazas" page.

## Requirements

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

### Requirement: List the trail

The system SHALL return the caller's trail: their recorded traces together with their signature records, each signature shown as a "document signed" entry at its signing time, so every signature appears in the trail including those made before traces existed. The trail SHALL be ordered newest first, ties broken by entry id descending, and SHALL include entries whose document, certificate or version has been deleted. The response SHALL be paginated by an opaque cursor: a page holds at most the requested limit (25 by default, at most 100), carries the cursor of the next page or none when there are no more entries, and carries the total number of entries that match the filters regardless of pagination. A malformed cursor SHALL be rejected with a bad-request error. Entries of other users SHALL never be returned.

Each entry SHALL carry its id, type, moment, client IP when recorded, the document it concerns (id, current name, whether it is deleted) or none, the certificate it concerns (id, alias, holder name, whether it is deleted) or none, the version (id, number, whether it is deleted) or none, and the details of its type. A "document signed" entry SHALL also carry every field a signature log record carries (`signature-log`, "List the signature log").

#### Scenario: Signatures and other traces together

- **WHEN** a user imported certificate X, then uploaded document A, then signed A with X
- **THEN** the trail SHALL list "document signed", "document uploaded" and "certificate imported", in that order

#### Scenario: Signatures from before traces existed

- **WHEN** a user signed a document before traces were recorded
- **THEN** that signature SHALL appear in the trail as a "document signed" entry

#### Scenario: Paging through the trail

- **WHEN** a user with 30 entries requests a page of 25 and then the page after its cursor
- **THEN** the first page SHALL hold the 25 most recent entries with a next cursor and a total of 30, and the second SHALL hold the remaining 5 with no next cursor, with no entry repeated or skipped

#### Scenario: Entries survive deletions

- **WHEN** the document or certificate of an entry has been deleted
- **THEN** the entry SHALL still be listed with the document name or the certificate alias and holder, flagged as deleted

#### Scenario: Signature of a deleted version

- **WHEN** a user signed a document, producing version 2, and then deleted version 2
- **THEN** the trail SHALL list "document version deleted" and "document signed", both with version 2 flagged as deleted

#### Scenario: Only the caller's entries

- **WHEN** two users have each acted on their documents
- **THEN** each user's trail SHALL contain only their own entries

#### Scenario: Malformed cursor

- **WHEN** the request sends a cursor the system did not issue
- **THEN** the system SHALL reject it with a bad-request error

### Requirement: Filter the trail

The trail SHALL accept, all optional and combined with AND: a set of types to include and a set of types to exclude; a certificate id, returning only entries that concern that certificate; a text, returning only entries whose document name or certificate alias contains it, case-insensitively, with `%`, `_` and `\` matched literally; a start instant, returning only entries at or after it; and an end instant, returning only entries strictly before it. A type both included and excluded, a certificate that does not belong to the caller, and a start instant that is not before the end instant SHALL be rejected: the first and the last with a bad-request error, the certificate with not found. The total count SHALL reflect the filters.

#### Scenario: By type

- **WHEN** the user includes only "certificate imported" and "certificate deleted"
- **THEN** only entries of those two types SHALL be listed and the total SHALL count only those

#### Scenario: Excluding a type

- **WHEN** the user excludes "document downloaded"
- **THEN** every entry except downloads SHALL be listed

#### Scenario: By certificate

- **WHEN** the user filters by certificate X
- **THEN** only the traces of X and the signatures made with X SHALL be listed

#### Scenario: Text matches documents and certificates

- **WHEN** the user filters by "fnmt", has a certificate aliased "FNMT personal" and a document named "fnmt-guía.pdf"
- **THEN** the entries of both SHALL be listed

#### Scenario: By date range

- **WHEN** the user filters from the start of 1 October to the start of 8 October
- **THEN** only entries in that interval SHALL be listed, including one exactly at the start and excluding one exactly at the end

#### Scenario: Invalid filters

- **WHEN** a type is both included and excluded, or the start instant is the same as or later than the end instant
- **THEN** the system SHALL reject the request with a bad-request error

#### Scenario: Another user's certificate

- **WHEN** the filter names a certificate of another user
- **THEN** the system SHALL answer not found

### Requirement: Certificates of the trail

The system SHALL list every certificate of the caller, including deleted ones, each with its id, alias, holder name and whether it is deleted, ordered by alias.

#### Scenario: Deleted certificate still offered

- **WHEN** the user imported certificate X and then deleted it
- **THEN** X SHALL be listed, flagged as deleted

### Requirement: Traces page

The frontend SHALL offer signed-in users a "Trazas" page at `/traces`, reachable from the navbar in the place "Firmas" had and from the surface search, that lists their trail newest first as a timeline grouped by recency ("Hoy", "Esta semana", "Este mes"…) and loads further entries as the user scrolls. Each entry SHALL show an icon and a Spanish label for its type ("Certificado importado", "Certificado renombrado", "Contraseña recordada", "Contraseña olvidada", "Certificado eliminado", "Acceso con certificado", "Documento subido", "Documentos unidos", "Páginas editadas", "Documento firmado", "Documento descargado", "Documento renombrado", "Documento movido", "Versión eliminada", "Documento eliminado", "Navegador conectado", "Navegador desconectado", "Navegador desbloqueado", "Código incorrecto en el navegador", "Navegador bloqueado", "Comando de instalación rechazado", "Inicio de sesión", "Inicio de sesión fallido", "Cierre de sesión", "Nombre cambiado", "Contraseña cambiada", "Verificación en dos pasos activada", "Verificación en dos pasos desactivada", "Código de verificación incorrecto"), the document name, certificate alias or browser name it concerns, how long ago it happened ("hace 20 horas", "ayer") and its exact date and time with the client IP when recorded, and one sentence on what happened (the version, the previous and new name, the origin and destination folder, the merged documents, the browser that used the certificate to sign in, or, for a signature, the certificate, the version and whether it is invisible or visible on which pages). Deleted documents and certificates SHALL be marked "eliminado", and a version that has been deleted SHALL be marked "eliminada" wherever the entry names it. The page hero SHALL show the total number of entries that match the filters. All text SHALL be in Spanish. `/signatures` SHALL no longer exist.

#### Scenario: Open the trail

- **WHEN** a user who imported a certificate and then signed two documents opens `/traces`
- **THEN** the page SHALL list the two signatures and then the import, the most recent first

#### Scenario: A sign-in with the browser token

- **WHEN** a user whose browser token signed in to a site with the certificate "FNMT personal" through the token key "Firefox portátil" opens `/traces`
- **THEN** the page SHALL list an "Acceso con certificado" entry for "FNMT personal" saying that "Firefox portátil" used it to sign in

#### Scenario: Security failures stand out

- **WHEN** a user's trail holds a "Código incorrecto en el navegador" and an "Inicio de sesión fallido" entry
- **THEN** the page SHALL mark both as failures, the way it marks deletions

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

### Requirement: Traces page filters

The traces page SHALL offer, through the shared list filter experience, a text search over the document name and certificate alias, a "Tipo" facet whose options are the trace types and that supports including and excluding them, a certificate selector listing the certificates of the trail (deleted ones marked "eliminado"), and a "Desde" and a "Hasta" day. "Desde" and "Hasta" SHALL each include the whole chosen day in the browser's time zone. Each active filter SHALL show as a removable chip.

#### Scenario: Only signatures

- **WHEN** the user includes only "Documento firmado" in "Tipo"
- **THEN** the page SHALL list only signatures, as the former signatures page did

#### Scenario: A one-day range

- **WHEN** the user picks 7 October as both "Desde" and "Hasta"
- **THEN** the page SHALL list every entry of 7 October in the browser's time zone, from 00:00 to 23:59:59

#### Scenario: Removing the type chip

- **WHEN** a type and a text filter are active and the user removes the type chip
- **THEN** the list SHALL show the entries matching only the text

### Requirement: Trace detail

Choosing a row SHALL open a detail panel for that entry without leaving the page. A "Documento firmado" entry SHALL show the full signature detail: the document name, linked to `/documents/[id]` unless the document is deleted; the version number, marked "eliminada" when that version has been deleted; the signing date and time with seconds; invisible, or visible with its pages; the reason and location when present; the SHA-256 before and after signing and the certificate fingerprint, each copyable; the client IP when recorded; the timestamp as "Sello de tiempo" with the time the TSA asserted, with seconds, and the TSA's name, or "Sin sello de tiempo" when the signature carries none; and the certificate's alias, holder, tax identifier, issuer, serial number and validity period, marked "eliminado" when deleted. Any other entry SHALL show its type, the date and time with seconds, the client IP when recorded, the document linked to `/documents/[id]` unless deleted, or the certificate with its alias and holder, marked "eliminado" when deleted, the version when it has one, marked "eliminada" when it has been deleted, and its details: the previous and new name or alias, the origin and destination folder ("Biblioteca" for the root), or the merged documents in order, or the token key name for a sign-in with the browser token. A browser entry SHALL show the browser name, and for a connection its platform and for a failure its reason in Spanish ("código incorrecto", "demasiados intentos", "comando caducado", "comando ya usado"); an account entry SHALL show how the user signed in (password or SSO) and the browser's user agent when recorded, and the previous and new name for a name change.

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

#### Scenario: Detail of a failed unlock

- **WHEN** the user opens a "Código incorrecto en el navegador" entry for "Firefox portátil" that triggered the lockout
- **THEN** the panel SHALL show "Firefox portátil", the reason "demasiados intentos", the date with seconds and the client IP

#### Scenario: Deleted document

- **WHEN** the user opens an entry whose document has been deleted
- **THEN** the panel SHALL show the document name marked "eliminado" and SHALL not link to it

#### Scenario: Signature of a deleted version

- **WHEN** the user opens a signature entry whose version 2 has since been deleted
- **THEN** the panel SHALL show version 2 marked "eliminada" and keep every other field of the signature

### Requirement: Record traces of browser token actions

The system SHALL record a trace, attributed to the token key's owner, for each of these browser token actions: a browser connected (an install code redeemed, keeping the new key's id and name and the module platform), a browser disconnected (a token key revoked from the certificates page, keeping its id and name), a browser unlocked (a TOTP code accepted), and a browser locked (the lock procedure). It SHALL also record these refused actions, which matter for security: a TOTP code refused for a token key (keeping whether it was wrong or refused because of the lockout), and an install code refused because it was already used or had expired while its owner is still known (keeping the browser name the connection was started for and the reason). Each trace SHALL carry the moment, the client IP when the request carried one and, as details, the key or connection it concerns; it SHALL concern no document and no certificate. Other refused browser token requests (unknown key, malformed data, a closed signing window) SHALL NOT be traced. A trace of a completed action SHALL be written only when the action succeeded.

#### Scenario: Connecting a browser

- **WHEN** the install script redeems a code started by a user for "Firefox portátil" on Linux x86_64
- **THEN** a "browser connected" trace SHALL be recorded for that user, keeping the new key's id, "Firefox portátil" and `linux-x86_64`

#### Scenario: A wrong code in the browser

- **WHEN** a browser sends a wrong TOTP code for the token key "Firefox portátil"
- **THEN** a "browser unlock failed" trace SHALL be recorded for its owner with the reason "wrong code" and no window SHALL open

#### Scenario: The lockout

- **WHEN** a browser sends a code while its owner is locked out after 5 wrong codes
- **THEN** a "browser unlock failed" trace SHALL be recorded with the reason "locked out"

#### Scenario: A used command

- **WHEN** someone runs an install command whose code was already redeemed
- **THEN** a "browser install refused" trace SHALL be recorded for the user who started that connection, with the reason "already used", and nothing else SHALL change

#### Scenario: An unknown code

- **WHEN** someone redeems a code that was never issued
- **THEN** no trace SHALL be recorded, since no user owns it

### Requirement: Record traces of account actions

The system SHALL record a trace for each of these account actions of a user: signed in (by password or single sign-on, keeping the method and the browser's user agent), signed out, name changed (keeping the previous and the new name), password changed, two-step verification turned on, and two-step verification turned off. It SHALL also record these refused actions, which matter for security: a password sign-in refused for an existing account (wrong password or banned account), and a two-step verification code refused at sign-in. A refused sign-in for an email no account has SHALL NOT be traced. Each trace SHALL carry the moment and the client IP when the request carried one, and SHALL concern no document and no certificate. Neither the password nor any code SHALL be stored in a trace.

#### Scenario: Signing in

- **WHEN** a user signs in with email and password from Firefox at `203.0.113.7`
- **THEN** a "signed in" trace SHALL be recorded with the method "password", Firefox's user agent and the IP `203.0.113.7`

#### Scenario: A wrong password

- **WHEN** someone types a wrong password for an existing account
- **THEN** a "sign-in failed" trace SHALL be recorded for that account, without the password

#### Scenario: A wrong two-step code

- **WHEN** a user passes the password step and types a wrong two-step verification code
- **THEN** a "two-step code refused" trace SHALL be recorded for that user

#### Scenario: Turning two-step verification off

- **WHEN** a user turns two-step verification off from their profile
- **THEN** a "two-step verification turned off" trace SHALL be recorded

#### Scenario: Changing the name

- **WHEN** a user renames themselves from "Ana" to "Ana López"
- **THEN** a "name changed" trace SHALL be recorded keeping "Ana" and "Ana López"
