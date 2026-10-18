## ADDED Requirements

### Requirement: Emergency switches

The system SHALL keep three settings for the browser token, changeable by administrators only and applied from the next request on, without a restart: **token enabled** (default on), **installs enabled** (default on) and **minimum module version** (default none, otherwise a version such as `0.2.0`). While the token is off, every procedure called with a token key (listing, unlocking, locking, signing) and every install procedure (starting a connection, redeeming, the install script, the module download) SHALL be refused with a service-unavailable error whose message says, in Spanish, that the browser token is temporarily disabled. While installs are off, the install procedures SHALL be refused the same way and the procedures called with a token key SHALL keep working. A token-key request from a module older than the minimum version SHALL be refused with a precondition-failed error whose message tells, in Spanish, to connect the browser again; it SHALL NOT be refused as a closed signing window. A refused request SHALL sign nothing and record no trace. When no settings were ever saved, the token and installs SHALL be enabled with no minimum version.

#### Scenario: Token off

- **WHEN** an administrator turns the token off and a connected browser then asks to sign
- **THEN** the system SHALL refuse with a service-unavailable error, sign nothing and record no trace

#### Scenario: Installs off

- **WHEN** installs are off and a user starts a connection
- **THEN** the system SHALL refuse it with a service-unavailable error, while an already connected browser SHALL still list its certificates and sign

#### Scenario: Install script while installs are off

- **WHEN** installs are off and someone runs an install command
- **THEN** the script served SHALL only print, in Spanish, that connecting browsers is temporarily disabled, and change nothing

#### Scenario: Outdated module

- **WHEN** the minimum module version is `0.2.0` and a module reporting `0.1.0`, or reporting no version, asks for the certificate list
- **THEN** the system SHALL refuse it with a precondition-failed error telling to connect the browser again

#### Scenario: No settings saved

- **WHEN** the settings were never saved
- **THEN** the token and installs SHALL work as before this change

#### Scenario: Not an administrator

- **WHEN** a user without the admin role reads or changes the settings
- **THEN** the system SHALL refuse it as forbidden

### Requirement: Module version reporting

The browser module SHALL send its version and platform in every request to Garabato, in the `x-garabato-module` header (`<version> <os>-<arch>`, for example `0.2.0 windows-x86_64`). A token-key request without the header SHALL be treated as version `0.1.0`. The system SHALL remember, for each token key, the last module version and platform it reported. When the backend refuses a request because the token is off or the module is outdated, the module SHALL show no certificates, SHALL NOT report the token as logged out, and SHALL write the reason to its log.

#### Scenario: Version remembered

- **WHEN** a module reporting `0.2.0 linux-x86_64` lists its certificates
- **THEN** the system SHALL remember `0.2.0` and `linux-x86_64` for that token key

#### Scenario: A refusal is not a closed window

- **WHEN** the token is off and the browser asks the module to sign
- **THEN** the module SHALL fail the signature without marking the token as logged out, so the browser does not ask for a code in a loop

### Requirement: Browser token admin page

The admin area SHALL offer a "Token del navegador" page at `/admin/browser-token`, for administrators only, listed with the other admin pages. It SHALL show the three switches with their current values, when and by whom they were last changed, and how many connected browsers report each module version and platform (browsers that never reported one counted as `0.1.0`), with the version the installers currently serve. Turning the token off, turning installs off or raising the minimum version SHALL ask for confirmation, saying how many connected browsers it affects. Each change SHALL be recorded in the activity log with the administrator who made it and the old and new values. All text SHALL be in Spanish.

#### Scenario: Turn the token off

- **WHEN** an administrator turns the token off and confirms
- **THEN** the setting SHALL be saved, the page SHALL show it off with the administrator and the time, and the activity log SHALL record the change

#### Scenario: Versions in use

- **WHEN** three connected browsers report `0.2.0` and one reported nothing
- **THEN** the page SHALL show three on `0.2.0` and one on `0.1.0`

#### Scenario: Raising the minimum version

- **WHEN** an administrator sets the minimum version to `0.2.0` while one connected browser is on `0.1.0`
- **THEN** the confirmation SHALL say that one browser will stop working until it is connected again

### Requirement: Switch state on the certificates page

The certificates page SHALL reflect the switches for every signed-in user: while the token or installs are off, "Conectar navegador" SHALL say that connecting browsers is temporarily disabled instead of offering the form; while the token is off, the connected browsers section SHALL say that the browser token is temporarily disabled; a connected browser whose last reported module version is below the minimum SHALL be marked as outdated with a hint to connect it again. All text SHALL be in Spanish.

#### Scenario: Installs off for a user

- **WHEN** installs are off and a user chooses "Conectar navegador"
- **THEN** the dialog SHALL say that connecting browsers is temporarily disabled and offer no command

#### Scenario: Outdated browser in the list

- **WHEN** the minimum version is `0.2.0` and the user's "Firefox portátil" last reported `0.1.0`
- **THEN** the list SHALL mark "Firefox portátil" as outdated and suggest connecting it again
