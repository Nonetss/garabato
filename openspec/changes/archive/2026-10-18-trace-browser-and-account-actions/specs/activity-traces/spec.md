## MODIFIED Requirements

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

## ADDED Requirements

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
