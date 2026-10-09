# Two-Factor Authentication

## Purpose

Lets each user protect their email/password sign-in with an opt-in TOTP second factor through Better Auth's `twoFactor` plugin: enrolment and removal from the profile page, backup codes, the second sign-in step and trusted devices, and which sign-ins it does not cover (SSO, API keys).

## Requirements

### Requirement: Opt-in TOTP two-factor authentication

The system SHALL register Better Auth's `twoFactor` plugin with TOTP and backup codes, so that each user can choose to protect their email/password sign-in with a second factor. Two-factor authentication SHALL be off for every user until that user turns it on, and SHALL never be required by the system. The TOTP issuer shown in authenticator apps SHALL be the product name. Two-factor data SHALL be stored in a `two_factor` table and a `two_factor_enabled` column on `user`, as the plugin defines them.

#### Scenario: New user has no second factor

- **WHEN** a user signs up or is created by an admin
- **THEN** their account SHALL have two-factor authentication off and their sign-in SHALL ask only for email and password

#### Scenario: Plugin is registered

- **WHEN** the backend starts
- **THEN** the Better Auth instance SHALL include the `twoFactor` plugin and expose its endpoints under `/api/auth/two-factor/`

### Requirement: Enrol from the profile page

The profile page (`/me`) SHALL show whether two-factor authentication is on for the signed-in user and let them turn it on. Turning it on SHALL ask for the account password, then show a QR code with its `otpauth://` URI (and the secret for manual entry) and the backup codes. It SHALL ask for a current code from the authenticator app, and SHALL mark two-factor as on only after that code is verified. A user whose account has no password (SSO only) SHALL be told that two-factor applies to password sign-in and that their identity provider handles it.

#### Scenario: User turns two-factor on

- **WHEN** a signed-in user enters their password, scans the QR code and submits a valid code from the app
- **THEN** two-factor authentication SHALL be on for that user and the profile SHALL show it as active

#### Scenario: Wrong code during enrolment

- **WHEN** the user submits an invalid code while enrolling
- **THEN** two-factor authentication SHALL stay off and the page SHALL show an error in Spanish

#### Scenario: Enrolment abandoned

- **WHEN** the user closes the enrolment dialog before verifying a code
- **THEN** two-factor authentication SHALL stay off and their next sign-in SHALL NOT ask for a code

#### Scenario: Wrong password

- **WHEN** the user enters a wrong password to start enrolment
- **THEN** no secret SHALL be generated and the dialog SHALL show an error in Spanish

### Requirement: Manage two-factor from the profile page

A user with two-factor authentication on SHALL be able, from the profile page and after re-entering their password, to turn it off and to generate a new set of backup codes, which replaces the previous set.

#### Scenario: User turns two-factor off

- **WHEN** a user with two-factor on confirms with their password that they want to turn it off
- **THEN** two-factor authentication SHALL be off and their next sign-in SHALL ask only for email and password

#### Scenario: User regenerates backup codes

- **WHEN** a user with two-factor on confirms with their password that they want new backup codes
- **THEN** the page SHALL show a new set and the previous codes SHALL stop working

### Requirement: Second sign-in step

When a user with two-factor authentication on signs in with a correct email and password, the system SHALL NOT create a full session until a valid TOTP code or an unused backup code is submitted. The sign-in page SHALL then ask for the 6-digit code, let the user switch to a backup code, and offer to trust the device for 30 days, after which that browser SHALL skip the second step for that user. A wrong code SHALL show an error in Spanish and SHALL be retryable; repeated wrong codes SHALL be throttled by Better Auth.

#### Scenario: Correct code completes the sign-in

- **WHEN** a user with two-factor on enters a correct password and then a valid code from their app
- **THEN** the session SHALL be created and the user SHALL land on `/`

#### Scenario: Wrong code

- **WHEN** the user enters an invalid code at the second step
- **THEN** no session SHALL be created and the page SHALL show an error and let them try again

#### Scenario: Backup code

- **WHEN** the user chooses to use a backup code and enters an unused one
- **THEN** the session SHALL be created and that backup code SHALL no longer be valid

#### Scenario: Trusted device

- **WHEN** the user ticks "trust this device" while completing the second step and signs in again from the same browser within 30 days
- **THEN** the sign-in SHALL NOT ask for a code

#### Scenario: Correct password alone is not enough

- **WHEN** a client submits a correct email and password for a user with two-factor on and never submits a code
- **THEN** no session usable by protected routes SHALL exist for that user

### Requirement: Scope of the second factor

Two-factor authentication SHALL apply to email/password sign-in only. Sign-in through OIDC SHALL NOT ask for a code, since the identity provider owns that sign-in, and requests authenticated with an API key SHALL NOT ask for one.

#### Scenario: SSO sign-in

- **WHEN** a user with two-factor on signs in through OIDC
- **THEN** the sign-in SHALL complete without asking for a code

#### Scenario: API key request

- **WHEN** a request authenticates with a valid `x-api-key` belonging to a user with two-factor on
- **THEN** it SHALL be served without asking for a code
