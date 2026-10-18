## MODIFIED Requirements

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

## ADDED Requirements

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
