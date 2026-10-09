## ADDED Requirements

### Requirement: Configurable sign-up

The system SHALL let the operator turn off self-service account creation with the `DISABLE_SIGN_UP` server variable. When it is `true`, Better Auth SHALL refuse the email/password sign-up endpoint and SHALL refuse to create a new user on an OIDC sign-in whose identity has no account yet, while existing users keep signing in and admins keep creating accounts through the admin plugin. When it is unset or `false`, sign-up SHALL behave as before. The public `v1.authConfig.get` procedure SHALL report the setting as `signUpEnabled` (the negation of `DISABLE_SIGN_UP`), and the frontend SHALL follow it: the sign-in page SHALL show the link to `/signup` only when `signUpEnabled` is `true`, and `/signup` SHALL NOT offer the sign-up form when it is `false`, pointing the visitor to `/login` instead.

#### Scenario: Sign-up enabled by default

- **WHEN** the backend starts without `DISABLE_SIGN_UP`
- **THEN** a visitor SHALL be able to create an account from `/signup`, `v1.authConfig.get` SHALL return `signUpEnabled: true`, and the sign-in page SHALL show the sign-up link

#### Scenario: Email sign-up refused when disabled

- **WHEN** `DISABLE_SIGN_UP` is `true` and a client calls the email/password sign-up endpoint directly
- **THEN** Better Auth SHALL reject the request and SHALL NOT create a user

#### Scenario: OIDC sign-up refused when disabled

- **WHEN** `DISABLE_SIGN_UP` is `true`, OIDC is configured, and someone signs in through SSO with an identity that has no account
- **THEN** no user SHALL be created and the sign-in SHALL fail

#### Scenario: Existing OIDC user signs in when disabled

- **WHEN** `DISABLE_SIGN_UP` is `true` and a user who already has an account signs in through SSO
- **THEN** the sign-in SHALL succeed

#### Scenario: Frontend hides sign-up when disabled

- **WHEN** `v1.authConfig.get` returns `signUpEnabled: false`
- **THEN** the sign-in page SHALL NOT show the sign-up link, and `/signup` SHALL show that registration is closed with a link to `/login` instead of the form

#### Scenario: Admin creates an account when disabled

- **WHEN** `DISABLE_SIGN_UP` is `true` and an admin creates a user from the admin users page
- **THEN** the account SHALL be created

## MODIFIED Requirements

### Requirement: Admin account seeding

On backend startup, after running database migrations, the system SHALL create an administrator account from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` (defaulting to `Admin`) with the global `admin` role, unless an account with that email already exists. Seeding SHALL create the account through Better Auth's admin `createUser` operation called server-side, never through the public sign-up endpoint, so it works whether or not `DISABLE_SIGN_UP` is set. Seeding SHALL be skipped when `ADMIN_EMAIL` or `ADMIN_PASSWORD` is not set.

#### Scenario: Admin does not exist yet

- **WHEN** the backend starts with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set and no user has that email
- **THEN** the system SHALL create that user through Better Auth's admin `createUser` with the `admin` role

#### Scenario: Admin seeded with sign-up disabled

- **WHEN** the backend starts with `DISABLE_SIGN_UP=true`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` set and no user has that email
- **THEN** the administrator account SHALL still be created

#### Scenario: Admin already exists

- **WHEN** the backend starts and a user with `ADMIN_EMAIL` already exists
- **THEN** the system SHALL NOT create or modify any user

#### Scenario: Seed variables are missing

- **WHEN** the backend starts without `ADMIN_EMAIL` or without `ADMIN_PASSWORD`
- **THEN** the system SHALL skip admin seeding and log that it was skipped
