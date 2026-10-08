# Admin

## Purpose

Enables the Better Auth Admin plugin and defines the admin role, account banning and the admin panel pages for plugins, activity log, session history and API keys.

## Requirements

### Requirement: Admin plugin enabled

The system SHALL enable the Better Auth Admin plugin on both the server and the auth client, using the default `user` and `admin` roles.

#### Scenario: Admin client operations are available

- **WHEN** the auth client is initialized with the admin client plugin
- **THEN** admin operations (list users, set role, ban, impersonate) SHALL be callable from the client

### Requirement: Admin schema fields

The system SHALL extend the `user` table with `role` (default `user`), `banned`, `banReason`, and `banExpires` fields, and SHALL extend the `session` table with an `impersonatedBy` field.

#### Scenario: User carries a role

- **WHEN** a user record is created
- **THEN** it SHALL have a `role` field defaulting to `user`

#### Scenario: Impersonated session is attributable

- **WHEN** an admin impersonates a user
- **THEN** the resulting session SHALL record the admin id in `impersonatedBy`

### Requirement: Role-based administrative access

The system SHALL restrict administrative operations to users holding the `admin` role.

#### Scenario: Admin performs a privileged action

- **WHEN** a user with the `admin` role performs an administrative operation
- **THEN** the system SHALL allow it

#### Scenario: Non-admin attempts a privileged action

- **WHEN** a user without the `admin` role attempts an administrative operation
- **THEN** the system SHALL deny it

### Requirement: Account banning blocks access

The system SHALL prevent banned users from signing in and SHALL revoke their existing sessions.

#### Scenario: Banned user is denied

- **WHEN** a banned user attempts to sign in
- **THEN** the system SHALL reject the sign-in

### Requirement: Plugin visibility

The admin panel SHALL provide a read-only Plugins page listing the Better Auth plugins currently enabled on the server, sourced from the live server configuration rather than a hardcoded list, so the page cannot drift from reality. Unrecognized plugin ids SHALL still be listed, with a generic label. The page SHALL NOT offer actions to enable, disable, configure or comment on a plugin.

#### Scenario: Plugins page reflects the server configuration

- **WHEN** an admin opens the Plugins page
- **THEN** the system SHALL list every plugin id present in the server's Better Auth configuration

#### Scenario: Plugins page has no plugin actions

- **WHEN** an admin views the Plugins page
- **THEN** the system SHALL NOT offer actions to enable, disable, configure or comment on a plugin, since configuration changes require server changes and the page is read-only

### Requirement: Administrative activity log

The admin panel SHALL provide a read-only activity log at `/admin/logs`,
sourced from indexed page-view and API-call log entries, filterable by
user, event type, path, and date range, and gated by the `admin` role.

#### Scenario: Admin opens the activity log

- **WHEN** an authenticated user with the `admin` role navigates to
  `/admin/logs`
- **THEN** the page SHALL render filterable, paginated activity entries
  with the associated user, event type, path, and timestamp

#### Scenario: Non-admin attempts to reach the activity log

- **WHEN** an authenticated user without the `admin` role requests
  `/admin/logs`
- **THEN** the application middleware SHALL redirect them to `/`

### Requirement: Administrative session history

The system SHALL provide administrators a read-only session history at
`/admin/sessions`, sourced from persisted session records and ordered from
newest to oldest.

#### Scenario: Administrator views persisted sessions

- **WHEN** an administrator opens `/admin/sessions`
- **THEN** the system SHALL show paginated session records with the associated
  user's identity, IP address, user-agent, creation time, update time,
  expiration time, and stored session metadata

#### Scenario: Expired sessions remain auditable

- **WHEN** a persisted session has expired
- **THEN** the system SHALL retain it in the history and identify it as expired

#### Scenario: Non-admin requests session history

- **WHEN** a user without the `admin` role requests the session-history API or
  route
- **THEN** the system SHALL deny access

#### Scenario: Session credential remains protected

- **WHEN** an administrator views session history
- **THEN** the system SHALL NOT expose the session token in the API response or
  interface

### Requirement: API key management

The admin panel SHALL expose API key management at `/admin/api-keys`, listing the API keys of the authenticated admin and allowing them to create and revoke keys. Non-admin authenticated users SHALL NOT reach this page; the request is redirected to the home page by the application middleware.

#### Scenario: Admin opens the API keys page

- **WHEN** an authenticated user with the `admin` role navigates to `/admin/api-keys`
- **THEN** the page SHALL render the admin's API keys and a "Nueva API key" action

#### Scenario: Non-admin attempts to reach the API keys page

- **WHEN** an authenticated user without the `admin` role requests `/admin/api-keys`
- **THEN** the application middleware SHALL redirect them to `/`
