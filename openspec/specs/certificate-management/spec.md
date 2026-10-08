# Certificate Management

## Purpose

Lets each signed-in user keep their own electronic signature certificates (PKCS#12 files) in the platform, stored encrypted, so they can later sign documents with them, and manage them: see their identity and validity, rename them, remember or forget their password and delete them.

## Requirements

### Requirement: Import a PKCS#12 certificate

The system SHALL let a signed-in user import a certificate by uploading a PKCS#12 file (`.p12` or `.pfx`, at most 100 KiB) together with its password, an optional alias (1 to 100 characters) and a flag that says whether to remember the password. The system SHALL open the file with the password and SHALL accept it only when it holds exactly one private key and a certificate whose public key matches that key. The imported certificate SHALL belong to the importing user. When no alias is given, the alias SHALL be the certificate holder's common name. The response SHALL return the stored certificate's metadata.

#### Scenario: Successful import

- **WHEN** a signed-in user uploads a valid PKCS#12 file with its correct password and the alias "FNMT personal"
- **THEN** the system SHALL store the certificate under that user with the alias "FNMT personal"
- **AND** SHALL respond with its metadata

#### Scenario: Alias defaults to the holder name

- **WHEN** a signed-in user imports a valid certificate without an alias
- **THEN** the stored alias SHALL be the certificate holder's common name

#### Scenario: Legacy and modern PKCS#12 encodings

- **WHEN** the uploaded file was exported with legacy encryption (3DES or RC2, as Windows and Firefox export) or with modern PBES2/AES encryption, holding an RSA or an EC key
- **THEN** the system SHALL import it the same way

#### Scenario: Wrong password

- **WHEN** the password does not open the uploaded file
- **THEN** the system SHALL reject the import with a bad-request error whose message tells the user, in Spanish, that the password is incorrect
- **AND** SHALL store nothing

#### Scenario: Not a usable PKCS#12 file

- **WHEN** the uploaded file is not a PKCS#12 file, is larger than 100 KiB, holds no private key, holds more than one, or holds no certificate matching its key
- **THEN** the system SHALL reject the import with a bad-request error and SHALL store nothing

#### Scenario: Certificate not meant for signing

- **WHEN** the certificate declares a key usage that includes neither digital signature nor non-repudiation
- **THEN** the system SHALL reject the import with a bad-request error and SHALL store nothing

#### Scenario: Expired certificate

- **WHEN** the certificate's validity period ended before the import
- **THEN** the system SHALL reject the import with a bad-request error and SHALL store nothing

#### Scenario: Duplicate certificate

- **WHEN** the user imports a certificate whose SHA-256 fingerprint matches one of their certificates that is not deleted
- **THEN** the system SHALL reject the import with a conflict error and SHALL store nothing

#### Scenario: Same certificate for two users

- **WHEN** two different users import the same certificate
- **THEN** the system SHALL accept both imports as separate certificates, each owned by its importer

#### Scenario: Anonymous caller

- **WHEN** a request without an authenticated session tries to import a certificate
- **THEN** the system SHALL reject it as unauthorized

### Requirement: Certificate metadata

On import the system SHALL read and store the certificate's public metadata: holder common name, given name and surname when present, tax identifier (NIF/NIE), issuer common name, serial number, SHA-256 fingerprint of the certificate, key algorithm (`RSA` or `EC`), and start and end of validity. The tax identifier SHALL be taken from the subject `serialNumber` attribute with any `IDC<country>-` prefix removed, and SHALL be empty when the subject has no `serialNumber`.

#### Scenario: Spanish personal certificate

- **WHEN** a user imports a certificate whose subject is `CN=ESPAÑOL PÉREZ JUAN - 12345678Z, serialNumber=IDCES-12345678Z, GN=JUAN, SN=ESPAÑOL PÉREZ`
- **THEN** the stored metadata SHALL have the common name `ESPAÑOL PÉREZ JUAN - 12345678Z`, given name `JUAN`, surname `ESPAÑOL PÉREZ` and tax identifier `12345678Z`, preserving accented characters

#### Scenario: Certificate without a tax identifier

- **WHEN** the imported certificate's subject has no `serialNumber` attribute
- **THEN** the stored tax identifier SHALL be empty and the import SHALL still succeed

### Requirement: Encrypted storage at rest

The system SHALL store the PKCS#12 file and any remembered password only in encrypted form, using authenticated encryption under a key unique to each certificate, itself encrypted with the server master key. Each encrypted value SHALL be bound to the certificate record it belongs to, so that it cannot be decrypted as part of another record. The system SHALL NOT store the PKCS#12 file, its private key or its password in plaintext anywhere.

#### Scenario: Database contents

- **WHEN** the certificate records are read directly from the database
- **THEN** neither the PKCS#12 bytes, the private key nor the password SHALL appear in plaintext

#### Scenario: Swapped ciphertext

- **WHEN** the encrypted file of one certificate record is copied into another record and the system tries to decrypt it there
- **THEN** decryption SHALL fail instead of returning the other certificate's file

#### Scenario: Tampered ciphertext

- **WHEN** a stored encrypted value is modified
- **THEN** decryption SHALL fail instead of returning altered data

### Requirement: Secrets never leave the server

No API response SHALL include the PKCS#12 file, the private key, the stored password or the encrypted forms of any of them. The system SHALL NOT write the password, the PKCS#12 file or the private key to any log. Responses SHALL only say whether a password is remembered.

#### Scenario: Reading a certificate

- **WHEN** a user lists their certificates or reads one of them
- **THEN** the response SHALL contain metadata and a `passwordRemembered` flag only

#### Scenario: Failed import is logged

- **WHEN** an import fails because of a wrong password
- **THEN** any log entry about that request SHALL NOT contain the password or the uploaded file

### Requirement: Owner-only access

A user SHALL only see and act on the certificates they imported. Acting on a certificate that does not exist, that is deleted or that belongs to another user SHALL fail with a not-found error, so its existence is not revealed.

#### Scenario: Another user's certificate

- **WHEN** a user tries to read, rename, delete or change the remembered password of a certificate imported by another user
- **THEN** the system SHALL answer not found and SHALL change nothing

### Requirement: List certificates with validity status

The system SHALL list the signed-in user's certificates that are not deleted, newest import first, each with its metadata, alias, `passwordRemembered` flag, import date and a validity status computed at request time: `expired` when its validity has ended, `expiring` when it ends within the next 30 days, and `valid` otherwise.

#### Scenario: Statuses

- **WHEN** a user holds one certificate ending in 90 days, one ending in 10 days and one that ended yesterday
- **THEN** the list SHALL show them as `valid`, `expiring` and `expired` respectively

#### Scenario: Deleted certificates are hidden

- **WHEN** a user lists their certificates after deleting one
- **THEN** the deleted certificate SHALL NOT appear in the list

### Requirement: Rename a certificate

The system SHALL let the owner change a certificate's alias to a new value of 1 to 100 characters, leaving every other field unchanged.

#### Scenario: Rename

- **WHEN** the owner renames a certificate to "Firma empresa"
- **THEN** subsequent reads SHALL return the alias "Firma empresa" with the same metadata

### Requirement: Remember or forget the password

The system SHALL let the owner turn on password remembering for a certificate by sending its password, and turn it off at any time. Turning it on SHALL verify the password against the stored file and SHALL replace any previously remembered password. Turning it off SHALL erase the remembered password. Importing with the remember flag set SHALL have the same effect as turning it on right after import.

#### Scenario: Turn on with the right password

- **WHEN** the owner turns on remembering with the certificate's correct password
- **THEN** the system SHALL store the password encrypted and the certificate SHALL report `passwordRemembered: true`

#### Scenario: Turn on with a wrong password

- **WHEN** the owner turns on remembering with a password that does not open the stored file
- **THEN** the system SHALL reject it with a bad-request error and SHALL keep the previous state

#### Scenario: Turn off

- **WHEN** the owner turns off remembering
- **THEN** the remembered password SHALL be erased and the certificate SHALL report `passwordRemembered: false`

### Requirement: Delete a certificate

The system SHALL let the owner delete a certificate. Deleting SHALL irreversibly erase its encrypted PKCS#12 file and remembered password, SHALL hide it from every listing and read, and SHALL keep its public metadata so that records referring to it can still identify it. After deletion the owner SHALL be able to import the same certificate again.

#### Scenario: Delete

- **WHEN** the owner deletes a certificate
- **THEN** its encrypted file and remembered password SHALL be erased, and it SHALL no longer be listed or readable

#### Scenario: Delete twice

- **WHEN** the owner deletes a certificate that is already deleted
- **THEN** the system SHALL answer not found

#### Scenario: Re-import after deletion

- **WHEN** the owner imports again a certificate they deleted earlier
- **THEN** the import SHALL succeed as a new certificate

### Requirement: Certificates page

The frontend SHALL offer signed-in users a "Certificados" page at `/certificates`, reachable from the navigation and the surface search, that lists their certificates with alias, holder name, tax identifier, issuer, expiry date, validity status and whether the password is remembered. From that page the user SHALL be able to import a certificate (choosing a `.p12`/`.pfx` file, typing its password, optionally an alias, and choosing whether to remember the password), rename it, turn password remembering on or off, and delete it after confirming. All page text SHALL be in Spanish, and the password SHALL be typed in a masked field.

#### Scenario: Empty state

- **WHEN** a user with no certificates opens `/certificates`
- **THEN** the page SHALL explain that they have no certificates and SHALL offer the import action

#### Scenario: Import from the page

- **WHEN** the user picks a file, types the correct password and confirms the import dialog
- **THEN** the new certificate SHALL appear in the list without reloading the page

#### Scenario: Import error is shown

- **WHEN** the import fails, for example because of a wrong password
- **THEN** the dialog SHALL stay open and SHALL show the Spanish error message returned by the API

#### Scenario: Delete needs confirmation

- **WHEN** the user chooses to delete a certificate
- **THEN** the page SHALL ask for confirmation, warning that the file is erased for good, before deleting it
