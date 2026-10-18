## MODIFIED Requirements

### Requirement: Browser module

The project SHALL provide a PKCS#11 module for Linux on x86_64 and ARM64, which Firefox, the browsers built on it and Chromium (NSS) load as a security device, and for Windows on x86_64, which Firefox and the browsers built on it load; each is installed by its install script. The module SHALL read the Garabato address and the token key from a configuration file in the user's configuration directory (`$XDG_CONFIG_HOME/garabato` on Linux, `%APPDATA%\Garabato` on Windows), which the install script writes, and SHALL write its log to the user's state directory (`$XDG_STATE_HOME/garabato` on Linux, `%LOCALAPPDATA%\Garabato` on Windows). It SHALL present one token named "Garabato" that requires a PIN, holding each certificate offered through the token with its public and private key; the private keys SHALL only be visible after login. Logging in SHALL send the PIN to the unlock procedure as the TOTP code and report a wrong PIN when it is rejected. Signing SHALL forward the data and mechanism to the sign procedure and return its signature. When the backend refuses a signature because the window is closed, the module SHALL report the token as logged out, so the browser asks for the code again on its next attempt. Logging out and unloading SHALL call the lock procedure. When the backend cannot be reached or the configuration is missing, or on Linux readable by other users, the token SHALL show no certificates instead of failing the browser. The module SHALL never write the PIN or the token key to its log.

#### Scenario: First sign-in to a site

- **WHEN** the user, with the module installed by the script, opens a site in Firefox that asks for a client certificate
- **THEN** Firefox SHALL ask for the "Garabato" token's password, and after the user types their current TOTP code, offer the certificates offered through the token, and complete the TLS handshake with the chosen one

#### Scenario: First sign-in on Windows

- **WHEN** the user, with the module installed by the Windows install script, opens a site in Firefox on Windows that asks for a client certificate
- **THEN** Firefox SHALL ask for the "Garabato" token's password, take the TOTP code, offer the certificates offered through the token and complete the TLS handshake with the chosen one, exactly as on Linux

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

The certificates page (`/certificates`) SHALL offer "Conectar navegador", which asks for a name for the browser, starts a connection and shows the command to paste in a terminal of that computer, for Linux and for Windows (PowerShell), with the one for the operating system the page runs on selected first, a button to copy it and how long it stays valid. The Windows command SHALL say that it supports Firefox and the browsers built on it only. While the dialog is open the page SHALL watch the connection and, once the install script has redeemed the code, SHALL say that the browser is connected and how to use it (type the authenticator code when the browser asks for the "Garabato" password); when the code expires unused it SHALL say so and offer a new one. The page SHALL list the user's connected browsers (their token keys) with name, creation date, last use and expiry, each with an action to disconnect it, which revokes its key after confirmation. A user without two-factor authentication SHALL be told to turn it on and SHALL get a link to `/me` instead of the creation form. All text SHALL be in Spanish.

#### Scenario: Connect Firefox

- **WHEN** a user with two-factor authentication on chooses "Conectar navegador", names it "Firefox portátil" and runs the command shown
- **THEN** the dialog SHALL change to say that "Firefox portátil" is connected, and "Firefox portátil" SHALL appear among the connected browsers

#### Scenario: Connect from Windows

- **WHEN** a user opens "Conectar navegador" on a Windows computer
- **THEN** the dialog SHALL show the PowerShell command first, say that on Windows only Firefox and the browsers built on it are supported, and still offer the Linux command

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

The system SHALL let a signed-in user with two-factor authentication on start a connection for a browser name (1 to 100 characters), answering an install code of 8 characters from an alphabet without look-alike characters, the Linux and the Windows commands that install the module with it, and when the code expires: 10 minutes later. Codes SHALL live only in memory and be single use. Redeeming a valid code SHALL create the token key and answer Garabato's public address, the key value and, for the operating system and architecture the script names, the SHA-256 of the module file. A used, expired or unknown code SHALL be rejected and create nothing. The user who started a connection SHALL be able to ask for its state: pending, connected (with the token key's id) or expired; another user SHALL get not found. A user without two-factor authentication SHALL be refused when starting a connection.

#### Scenario: Start a connection

- **WHEN** a user with two-factor authentication on starts a connection named "Firefox portátil"
- **THEN** the system SHALL answer an 8-character code, a Linux and a Windows command that contain it and an expiry 10 minutes away, and the connection SHALL be pending

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

The system SHALL serve the prebuilt module file without authentication, as a binary download, for Linux on `x86_64` and `aarch64` and for Windows on `x86_64`; Linux SHALL be assumed when the request names no operating system. It SHALL answer not found for any other operating system or architecture and for one whose file this installation does not ship.

#### Scenario: Download for x86_64

- **WHEN** a client downloads the module for `x86_64` from a production installation
- **THEN** the system SHALL answer the module file, whose SHA-256 matches the one the redeem response gives for `x86_64`

#### Scenario: Download for Windows

- **WHEN** a client downloads the module for Windows on `x86_64`
- **THEN** the system SHALL answer the Windows module file (a DLL), whose SHA-256 matches the one the redeem response gives for Windows on `x86_64`

#### Scenario: Windows on ARM

- **WHEN** a client asks for the module for Windows on `aarch64`
- **THEN** the system SHALL answer not found

#### Scenario: Unknown architecture

- **WHEN** a client asks for the module for `riscv64`
- **THEN** the system SHALL answer not found

## ADDED Requirements

### Requirement: Windows install script

The system SHALL serve, for a valid pending install code and the Windows operating system, a PowerShell script with Garabato's public address and the code built in, run with `irm '<url>' | iex`; for any other code it SHALL serve a PowerShell script that only prints, in Spanish, that the command expired. Run by the user (no administrator rights needed), the script SHALL: stop with a message on a processor other than x86_64; find the profiles of Firefox and of the browsers built on it (Zen, LibreWolf, Floorp, Waterfox) under `%APPDATA%`, including profiles their `profiles.ini` keeps elsewhere, and stop with a message when there is none; ask the user to close those browsers when one is running and wait for it; download the module, check its SHA-256 against the redeem response and install it under `%LOCALAPPDATA%\Garabato`; redeem the code only after the download succeeded; write the configuration file under `%APPDATA%\Garabato`; register the module as "Garabato" in each profile's NSS module list (`pkcs11.txt`), replacing an earlier registration and keeping every other entry and the file's encoding, without a byte-order mark; leave an uninstall script that removes the registrations, the module and the configuration; say that Chrome, Edge and Brave on Windows are not supported; and finish with a message in Spanish saying what to do next, naming each browser and profile it registered. The script SHALL never print the token key. Running it again with a new code SHALL replace the earlier installation.

#### Scenario: Install on Windows with Firefox

- **WHEN** a user runs the PowerShell command on an x86_64 Windows computer with one Firefox profile and Firefox closed
- **THEN** the module SHALL be installed under `%LOCALAPPDATA%\Garabato`, the configuration written under `%APPDATA%\Garabato`, the profile's `pkcs11.txt` SHALL gain a "Garabato" entry pointing at the module while keeping its other entries, and the script SHALL list "Firefox, perfil default-release"

#### Scenario: A registration already there

- **WHEN** the user runs a new command on a computer where "Garabato" is already registered
- **THEN** the profile's `pkcs11.txt` SHALL hold exactly one "Garabato" entry, pointing at the newly installed module

#### Scenario: Expired command on Windows

- **WHEN** a user runs a PowerShell command whose code expired
- **THEN** the script SHALL print that the command expired and change nothing

#### Scenario: Uninstall on Windows

- **WHEN** the user runs the uninstall script the installer left
- **THEN** the "Garabato" entry SHALL be removed from every profile's `pkcs11.txt`, keeping the other entries, and the module and the configuration SHALL be deleted
