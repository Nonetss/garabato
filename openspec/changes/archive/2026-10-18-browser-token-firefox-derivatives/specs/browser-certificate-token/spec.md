## MODIFIED Requirements

### Requirement: Install script

The system SHALL serve, for a valid pending install code, a POSIX shell script with Garabato's public address and the code built in; for any other code it SHALL serve a script that only prints, in Spanish, that the command expired and exits with an error. Run by the user (not root), the script SHALL: detect the architecture and stop with a message for an unsupported one; stop with the package to install when `curl`, `sha256sum` or `modutil` is missing; ask the user to close their browsers when Firefox, a browser built on it (Zen, LibreWolf, Floorp, Waterfox) or Chromium is running and wait for it; download the module, check its SHA-256 against the redeem response and install it under the user's data directory; redeem the code only after the download succeeded; write the configuration file with the address and the key, readable by the user only; register the module as "Garabato" in every profile found of Firefox and of the browsers built on it (Zen, LibreWolf, Floorp, Waterfox), including profiles their `profiles.ini` keeps outside their folder and profile names with spaces, naming each browser and profile it registered, and in Chromium's NSS database (creating it when missing), replacing an earlier registration; report Flatpak or Snap browsers as unsupported; leave an uninstall script that removes the registrations, the module and the configuration; and finish with a message in Spanish saying what to do next. The script SHALL never print the token key. Running it again with a new code SHALL replace the earlier installation.

#### Scenario: Install on a laptop with Firefox

- **WHEN** a user runs the command on an x86_64 laptop with one Firefox profile, Firefox closed and `modutil` installed
- **THEN** the module SHALL be installed, the configuration written with mode 600, "Garabato" registered in the Firefox profile and in Chromium's NSS database, and the script SHALL end saying the browser is ready

#### Scenario: Install on a laptop with Zen

- **WHEN** a user runs the command on a laptop whose browser is Zen, with the profile "52tw3itb.Default (release)"
- **THEN** "Garabato" SHALL be registered in that profile and the script SHALL list it as "Zen, perfil Default (release)"

#### Scenario: Missing modutil

- **WHEN** `modutil` is not installed
- **THEN** the script SHALL stop before redeeming the code and say which package provides it on Arch, Debian/Ubuntu and Fedora

#### Scenario: Expired command

- **WHEN** a user runs a command whose code expired
- **THEN** the script SHALL print that the command expired and that a new one is in Garabato, and change nothing

#### Scenario: Uninstall

- **WHEN** the user runs the uninstall script the installer left
- **THEN** "Garabato" SHALL be removed from every profile of Firefox and of the browsers built on it, and from Chromium's NSS database, and the module and the configuration SHALL be deleted
