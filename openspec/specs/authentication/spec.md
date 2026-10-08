# Authentication

## Purpose

Defines how users authenticate with Better Auth (email/password and optional OIDC), how sessions are stored and resolved on the backend, how the admin account is seeded, and how the browser client and Astro middleware enforce sessions.

## Requirements

### Requirement: Email and password authentication

The system SHALL allow users to authenticate using an email address and password. Email/password sign-in MUST be enabled in the Better Auth configuration exported as the `auth` singleton from `@nonete/auth`.

#### Scenario: User signs in with valid credentials

- **WHEN** a user submits a valid email and password to the sign-in endpoint
- **THEN** the system creates a session and returns the authenticated user

#### Scenario: User signs in with invalid credentials

- **WHEN** a user submits credentials that do not match any account
- **THEN** the system rejects the request and does not create a session

### Requirement: Optional OIDC sign-in

The system SHALL enable a generic OAuth (OIDC) provider with id `oidc` only when `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_DISCOVERY_URL` are all configured, requesting the `openid`, `profile` and `email` scopes from `<OIDC_DISCOVERY_URL>/.well-known/openid-configuration`. The public `v1.authConfig.get` procedure SHALL report whether SSO is configured as `ssoEnabled`, and the sign-in page SHALL offer the SSO option only when `ssoEnabled` is `true`.

#### Scenario: OIDC is fully configured

- **WHEN** the three `OIDC_*` variables are set
- **THEN** the auth instance SHALL include the generic OAuth plugin with provider `oidc`
- **AND** `v1.authConfig.get` SHALL return `ssoEnabled: true`, and the sign-in page SHALL show the SSO button

#### Scenario: OIDC is not configured

- **WHEN** any of the three `OIDC_*` variables is missing
- **THEN** the generic OAuth plugin SHALL NOT be registered, `v1.authConfig.get` SHALL return `ssoEnabled: false`, and the sign-in page SHALL hide the SSO option

### Requirement: Persistent session and user storage

The system SHALL persist users, sessions, accounts, and verification records in PostgreSQL using the Drizzle adapter configured with the `pg` provider and the shared auth schema from `@nonete/db`.

#### Scenario: Session is stored on sign-in

- **WHEN** a session is created during sign-in
- **THEN** a row SHALL be written to the `session` table referencing the owning `user`

### Requirement: Admin account seeding

On backend startup, after running database migrations, the system SHALL create an administrator account from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` (defaulting to `Admin`) and give it the global `admin` role, unless an account with that email already exists. Seeding SHALL be skipped when `ADMIN_EMAIL` or `ADMIN_PASSWORD` is not set.

#### Scenario: Admin does not exist yet

- **WHEN** the backend starts with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set and no user has that email
- **THEN** the system SHALL sign up that user through Better Auth and set its `role` to `admin`

#### Scenario: Admin already exists

- **WHEN** the backend starts and a user with `ADMIN_EMAIL` already exists
- **THEN** the system SHALL NOT create or modify any user

#### Scenario: Seed variables are missing

- **WHEN** the backend starts without `ADMIN_EMAIL` or without `ADMIN_PASSWORD`
- **THEN** the system SHALL skip admin seeding and log that it was skipped

### Requirement: Better Auth HTTP handler

The system SHALL expose all Better Auth endpoints through a single handler mounted at `/api/auth/*` that accepts GET and POST requests.

#### Scenario: Auth request is routed to the handler

- **WHEN** a request is made to a path under `/api/auth/`
- **THEN** the request SHALL be delegated to the Better Auth handler and its response returned unchanged

### Requirement: Trusted origins and secure cookies

The system SHALL only accept authenticated requests from the configured CORS origin and SHALL issue session cookies with `sameSite=lax`, `secure=true`, and `httpOnly=true`.

#### Scenario: Cross-site cookie is issued securely

- **WHEN** the server sets a session cookie
- **THEN** the cookie SHALL be marked `httpOnly`, `secure`, and `sameSite=lax`, so browsers withhold it from cross-site subrequests and form posts

#### Scenario: Request from an untrusted origin

- **WHEN** a request originates from an origin that is not the configured CORS origin
- **THEN** the auth API SHALL reject it

### Requirement: Session resolution middleware

The system SHALL resolve the current session on every request and expose the authenticated `user` and `session` (or `null`) to downstream handlers. Resolution MUST accept a session cookie, a Bearer token, or an `x-api-key` header.

#### Scenario: Authenticated request populates context

- **WHEN** a request carries a valid session credential
- **THEN** the middleware SHALL set `user` and `session` on the request context

#### Scenario: Anonymous request populates null context

- **WHEN** a request carries no valid session credential
- **THEN** the middleware SHALL set `user` and `session` to `null`

### Requirement: Authentication client SDK

The system SHALL provide a browser authentication client that calls Better Auth on the page's own origin (`/api/auth`, proxied to the backend by Caddy in production and by the Vite dev server in development), so the frontend can call auth, API key, organization and admin operations without cross-origin requests. The client MUST expose a reactive session hook so UI components re-render when the session changes.

#### Scenario: Client targets the configured server

- **WHEN** the browser auth client issues a request
- **THEN** it SHALL send the request to `/api/auth` on the current page's origin, which the proxy forwards to the backend

#### Scenario: Components observe the session reactively

- **WHEN** a component subscribes to the session via the client's session hook
- **THEN** it SHALL receive the current user and re-render when the authentication state changes

### Requirement: Frontend authentication middleware

The Astro frontend SHALL initialize `user` and `session` locals for every rendered request, SHALL enforce public and protected route boundaries by complete path segment, and SHALL preserve all cookie updates returned by session resolution.

#### Scenario: Public page has anonymous locals

- **WHEN** an anonymous request targets `/login`, `/signup`, or a descendant of either route
- **THEN** the middleware SHALL continue with both `user` and `session` set to `null`

#### Scenario: Public route prefix is not overmatched

- **WHEN** an anonymous request targets a path that merely begins with a public route name, such as `/login-private`
- **THEN** the middleware SHALL treat it as protected rather than public

#### Scenario: Public favicon remains available

- **WHEN** an anonymous request targets exactly `/logo.svg`
- **THEN** the middleware SHALL serve the route without requiring a user session

#### Scenario: Anonymous protected request

- **WHEN** session resolution succeeds without an authenticated session for a protected frontend route
- **THEN** the middleware SHALL redirect the request to `/login`

#### Scenario: Authentication service is unavailable

- **WHEN** the frontend cannot resolve a session because the authentication service returns an error
- **THEN** the middleware SHALL return an uncached `503 Service Unavailable` response and SHALL NOT represent the request as an anonymous session redirect

#### Scenario: Authenticated request populates frontend locals

- **WHEN** session resolution returns a valid user and session
- **THEN** the middleware SHALL expose both values through `Astro.locals` to the rendered route

#### Scenario: Administrative route boundary

- **WHEN** a non-admin user requests `/admin` or one of its descendant routes
- **THEN** the middleware SHALL redirect the user to `/`
- **AND** a path that merely begins with `admin`, such as `/administrator`, SHALL NOT be classified as an administrative route

#### Scenario: Multiple session cookies are refreshed

- **WHEN** Better Auth returns one or more `Set-Cookie` values while resolving a session
- **THEN** the middleware SHALL forward every cookie as a distinct response header, including on middleware-generated redirects or service-unavailable responses
