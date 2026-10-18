# browser-certificate-token Specification

## Purpose
Lets a user sign in to websites that ask for an electronic certificate (TLS client authentication) with the certificates kept in Garabato, through a PKCS#11 module the browser loads as a security device, so the certificate never has to be installed in the browser and its private key never leaves the server.

## Requirements

### Requirement: Token keys

The system SHALL let a signed-in user list and revoke their own token keys, the credentials a browser module uses to reach Garabato, and SHALL create a token key only by redeeming an install code (see "Install codes"). A token key SHALL belong to the user who started the connection, carry the name given then, and expire one year after creation; its value SHALL be returned only in the redeem response, to the install script. Listing SHALL return the caller's token keys that are not revoked, newest first, each with its id, name, creation date, expiry date and last use, never the key value. Revoking SHALL make the key unusable at once and close its signing window. Listing and revoking SHALL require a signed-in session: a request authenticated only with a token key SHALL be rejected as unauthenticated. A user SHALL never see, use or revoke another user's token keys.

#### Scenario: Create a token key

- **WHEN** the install script redeems a valid install code started by a user for "Firefox portátil"
- **THEN** a token key named "Firefox portátil" SHALL be created for that user, its value SHALL be returned to the script only, and the list SHALL show "Firefox portátil" with its creation and expiry dates and no value

#### Scenario: Revoke a token key

- **WHEN** the user revokes "Firefox portátil" while its signing window is open
- **THEN** every later request with that key SHALL be rejected as unauthenticated and the window SHALL be closed

#### Scenario: A token key cannot manage token keys

- **WHEN** a request authenticated only with a token key tries to start a connection, list or revoke token keys
- **THEN** the system SHALL reject it as unauthenticated

#### Scenario: Another user's key

- **WHEN** a user tries to revoke a token key of another user
- **THEN** the system SHALL answer not found

### Requirement: Two-factor authentication is required

The system SHALL refuse to create token keys, and SHALL refuse every procedure called with a token key, for a user whose two-factor authentication is off, with an error whose message tells them, in Spanish, to turn it on in their profile. Turning two-factor authentication off SHALL leave the user's token keys in place but unusable until it is turned on again.

#### Scenario: Creating a key without two-factor

- **WHEN** a signed-in user without two-factor authentication tries to create a token key
- **THEN** the system SHALL reject it with a message in Spanish asking them to turn on two-factor authentication, and SHALL create no key

#### Scenario: Two-factor turned off later

- **WHEN** a user with a token key turns two-factor authentication off and their browser token then asks for the certificate list
- **THEN** the system SHALL reject the request and SHALL NOT sign anything for that key

### Requirement: Certificates offered through the token

Called with a token key, the system SHALL list the key owner's certificates that can be used through the token: not deleted, within their validity period at request time, with a remembered password and an RSA key. Each SHALL carry its id, alias, holder common name and the DER of the certificate. Listing SHALL not need an open signing window. Certificates that do not meet every condition SHALL NOT be listed.

#### Scenario: Only usable certificates

- **WHEN** the key owner has certificate A (valid, password remembered), B (valid, password not remembered), C (expired, password remembered) and D (deleted)
- **THEN** the list SHALL contain only A

#### Scenario: Listing with the window closed

- **WHEN** the token asks for the list and the key's signing window is closed
- **THEN** the system SHALL still return the list

### Requirement: Unlock with a TOTP code

Called with a token key, the system SHALL accept a code from the key owner's authenticator app and, when it is valid, open that key's signing window for 15 minutes from that moment, or extend an open window to 15 minutes from that moment. Backup codes SHALL NOT be accepted. A code that already unlocked a window SHALL NOT be accepted again. A wrong code SHALL be rejected with a message in Spanish and SHALL leave the window as it was. After 5 wrong codes for the same user within 15 minutes, the system SHALL refuse every unlock for that user for 15 minutes, even with a right code, with a message in Spanish saying when to try again. The signing window of one token key SHALL NOT open the window of another.

#### Scenario: Right code

- **WHEN** the token sends the current code of the owner's authenticator app
- **THEN** the key's signing window SHALL be open until 15 minutes later

#### Scenario: Wrong code

- **WHEN** the token sends a code that is not valid now
- **THEN** the system SHALL reject it and the window SHALL stay closed

#### Scenario: Replayed code

- **WHEN** the token sends a code that already opened a window
- **THEN** the system SHALL reject it

#### Scenario: Too many wrong codes

- **WHEN** 5 wrong codes have been sent for a user within 15 minutes and the token then sends the right code
- **THEN** the system SHALL reject it and SHALL accept codes again only 15 minutes after the fifth wrong one

#### Scenario: Windows are per key

- **WHEN** the user unlocks the token key "Firefox portátil" and their token key "Chromium sobremesa" asks to sign
- **THEN** the system SHALL refuse the signature for "Chromium sobremesa"

### Requirement: Lock

Called with a token key, the system SHALL close that key's signing window at once. Locking a closed window SHALL succeed and change nothing.

#### Scenario: Lock an open window

- **WHEN** the token locks while its window is open and then asks to sign
- **THEN** the signature SHALL be refused

### Requirement: Sign for the token

Called with a token key whose signing window is open, the system SHALL sign data with one of the certificates offered through the token, opened with its remembered password, and return the signature. It SHALL support two mechanisms: PKCS#1 v1.5 over a DigestInfo already encoded by the caller, for SHA-256, SHA-384 or SHA-512; and RSA-PSS over a hash computed by the caller, for SHA-256, SHA-384 or SHA-512, with MGF1 using the same hash and a salt length from 0 to the hash length. The signature SHALL verify with the certificate's public key over the data the caller hashed. Data that does not fit the mechanism (a DigestInfo of another algorithm, a hash of the wrong length) SHALL be rejected as a bad request. A closed window, a certificate that is not offered through the token or another user's certificate SHALL make the system refuse to sign. Each signature SHALL be traced as a "certificate used to sign in" (`activity-traces`); a refused or failed signature SHALL leave no trace.

#### Scenario: TLS 1.3 signature

- **WHEN** the token sends a SHA-256 hash with RSA-PSS and salt length 32 for certificate A while the window is open
- **THEN** the system SHALL return an RSA-PSS signature that verifies with A's public key, and record one trace

#### Scenario: TLS 1.2 signature

- **WHEN** the token sends a SHA-256 DigestInfo with PKCS#1 v1.5 for certificate A while the window is open
- **THEN** the system SHALL return a PKCS#1 v1.5 signature that verifies with A's public key

#### Scenario: Window closed

- **WHEN** the token asks to sign after its window has expired
- **THEN** the system SHALL refuse, sign nothing and record no trace

#### Scenario: Certificate not offered

- **WHEN** the token asks to sign with a certificate whose password is not remembered
- **THEN** the system SHALL refuse and sign nothing

#### Scenario: Malformed data

- **WHEN** the token sends a 20-byte hash for RSA-PSS with SHA-256
- **THEN** the system SHALL reject it as a bad request

### Requirement: Browser module

The project SHALL provide a PKCS#11 module for Linux on x86_64 and ARM64 that Firefox and Chromium (NSS) load as a security device, installed by the install script. The module SHALL read the Garabato address and the token key from a configuration file in the user's configuration directory, which the install script writes. It SHALL present one token named "Garabato" that requires a PIN, holding each certificate offered through the token with its public and private key; the private keys SHALL only be visible after login. Logging in SHALL send the PIN to the unlock procedure as the TOTP code and report a wrong PIN when it is rejected. Signing SHALL forward the data and mechanism to the sign procedure and return its signature. When the backend refuses a signature because the window is closed, the module SHALL report the token as logged out, so the browser asks for the code again on its next attempt. Logging out and unloading SHALL call the lock procedure. When the backend cannot be reached or the configuration is missing or readable by other users, the token SHALL show no certificates instead of failing the browser. The module SHALL never write the PIN or the token key to its log.

#### Scenario: First sign-in to a site

- **WHEN** the user, with the module installed by the script, opens a site in Firefox that asks for a client certificate
- **THEN** Firefox SHALL ask for the "Garabato" token's password, and after the user types their current TOTP code, offer the certificates offered through the token, and complete the TLS handshake with the chosen one

#### Scenario: Resumed sessions

- **WHEN** the browser opens further connections to the same site and resumes the TLS session
- **THEN** no further code SHALL be asked and no further signature SHALL be requested

#### Scenario: Window expired

- **WHEN** the window expired and the site needs a new TLS handshake
- **THEN** that handshake SHALL fail and the browser SHALL ask for the token's password again on its next attempt

#### Scenario: Garabato unreachable

- **WHEN** the backend cannot be reached
- **THEN** the "Garabato" token SHALL show no certificates and the browser SHALL keep working

### Requirement: Connect a browser from the certificates page

The certificates page (`/certificates`) SHALL offer "Conectar navegador", which asks for a name for the browser, starts a connection and shows one command to paste in a terminal of that computer, with a button to copy it and how long it stays valid. While the dialog is open the page SHALL watch the connection and, once the install script has redeemed the code, SHALL say that the browser is connected and how to use it (type the authenticator code when the browser asks for the "Garabato" password); when the code expires unused it SHALL say so and offer a new one. The page SHALL list the user's connected browsers (their token keys) with name, creation date, last use and expiry, each with an action to disconnect it, which revokes its key after confirmation. A user without two-factor authentication SHALL be told to turn it on and SHALL get a link to `/me` instead of the creation form. All text SHALL be in Spanish.

#### Scenario: Connect Firefox

- **WHEN** a user with two-factor authentication on chooses "Conectar navegador", names it "Firefox portátil" and runs the command shown
- **THEN** the dialog SHALL change to say that "Firefox portátil" is connected, and "Firefox portátil" SHALL appear among the connected browsers

#### Scenario: The code expires

- **WHEN** ten minutes pass without the command being run
- **THEN** the dialog SHALL say that the command expired and offer to create a new one

#### Scenario: Disconnect a browser

- **WHEN** the user disconnects "Firefox portátil" and confirms
- **THEN** its key SHALL be revoked and it SHALL disappear from the list

#### Scenario: Two-factor off

- **WHEN** a user without two-factor authentication chooses "Conectar navegador"
- **THEN** the page SHALL tell them to turn on two-factor authentication and link to `/me`

### Requirement: Install codes

The system SHALL let a signed-in user with two-factor authentication on start a connection for a browser name (1 to 100 characters), answering an install code of 8 characters from an alphabet without look-alike characters, the command that installs the module with it, and when the code expires: 10 minutes later. Codes SHALL live only in memory and be single use. Redeeming a valid code SHALL create the token key and answer Garabato's public address, the key value and, for the architecture the script names, the SHA-256 of the module file. A used, expired or unknown code SHALL be rejected and create nothing. The user who started a connection SHALL be able to ask for its state: pending, connected (with the token key's id) or expired; another user SHALL get not found. A user without two-factor authentication SHALL be refused when starting a connection.

#### Scenario: Start a connection

- **WHEN** a user with two-factor authentication on starts a connection named "Firefox portátil"
- **THEN** the system SHALL answer an 8-character code, a command that contains it and an expiry 10 minutes away, and the connection SHALL be pending

#### Scenario: Redeem once

- **WHEN** the install script redeems the code and then redeems it again
- **THEN** the first redeem SHALL create the token key and answer its value, and the second SHALL be rejected and create nothing

#### Scenario: Expired code

- **WHEN** the install script redeems a code 11 minutes after it was created
- **THEN** the system SHALL reject it and the connection SHALL be expired

#### Scenario: Connected state

- **WHEN** the user asks for the state of a connection whose code was redeemed
- **THEN** the system SHALL answer connected with the new token key's id

### Requirement: Module downloads

The system SHALL serve the prebuilt module file for `x86_64` and `aarch64` without authentication, as a binary download. It SHALL answer not found for any other architecture and for an architecture whose file this installation does not ship.

#### Scenario: Download for x86_64

- **WHEN** a client downloads the module for `x86_64` from a production installation
- **THEN** the system SHALL answer the module file, whose SHA-256 matches the one the redeem response gives for `x86_64`

#### Scenario: Unknown architecture

- **WHEN** a client asks for the module for `riscv64`
- **THEN** the system SHALL answer not found

### Requirement: Install script

The system SHALL serve, for a valid pending install code, a POSIX shell script with Garabato's public address and the code built in; for any other code it SHALL serve a script that only prints, in Spanish, that the command expired and exits with an error. Run by the user (not root), the script SHALL: detect the architecture and stop with a message for an unsupported one; stop with the package to install when `curl`, `sha256sum` or `modutil` is missing; ask the user to close Firefox or Chromium when one is running and wait for it; download the module, check its SHA-256 against the redeem response and install it under the user's data directory; redeem the code only after the download succeeded; write the configuration file with the address and the key, readable by the user only; register the module as "Garabato" in every Firefox profile found and in Chromium's NSS database (creating it when missing), replacing an earlier registration; report Flatpak or Snap browsers as unsupported; leave an uninstall script that removes the registrations, the module and the configuration; and finish with a message in Spanish saying what to do next. The script SHALL never print the token key. Running it again with a new code SHALL replace the earlier installation.

#### Scenario: Install on a laptop with Firefox

- **WHEN** a user runs the command on an x86_64 laptop with one Firefox profile, Firefox closed and `modutil` installed
- **THEN** the module SHALL be installed, the configuration written with mode 600, "Garabato" registered in the Firefox profile and in Chromium's NSS database, and the script SHALL end saying the browser is ready

#### Scenario: Missing modutil

- **WHEN** `modutil` is not installed
- **THEN** the script SHALL stop before redeeming the code and say which package provides it on Arch, Debian/Ubuntu and Fedora

#### Scenario: Expired command

- **WHEN** a user runs a command whose code expired
- **THEN** the script SHALL print that the command expired and that a new one is in Garabato, and change nothing

#### Scenario: Uninstall

- **WHEN** the user runs the uninstall script the installer left
- **THEN** "Garabato" SHALL be removed from every Firefox profile and from Chromium's NSS database, and the module and the configuration SHALL be deleted
