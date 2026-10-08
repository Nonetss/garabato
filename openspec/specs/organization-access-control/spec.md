# Organization Access Control

## Purpose

Defines a shared access-control module with application permission statements and organization roles, preserving Better Auth's default permissions and wiring it into the server and client organization plugins.

## Requirements

### Requirement: Shared access-control module

The system SHALL define application permission statements, a merged
access-control instance, individual `owner`/`admin`/`member` role objects, and a
consolidated `roles` map in `packages/auth/src/permissions.ts`. Application
resource and action types SHALL be derived from the application statements so
consumers cannot request an undeclared resource/action pair.

#### Scenario: Single source of truth for roles

- **WHEN** either the server `organization()` plugin or a client
  `organizationClient()` plugin needs its access-control configuration
- **THEN** it SHALL import the same `ac` and `roles` values from
  `@nonete/auth/permissions` rather than declaring its own role map

#### Scenario: Permission pair is type checked

- **WHEN** backend code declares an application resource and action for
  authorization
- **THEN** TypeScript SHALL accept only combinations declared by
  `appStatements`

### Requirement: Default permissions preserved

The explicit `owner`, `admin`, and `member` organization roles SHALL preserve
Better Auth's built-in permissions for the `organization`, `member`, and
`invitation` resources. The `owner` and `admin` organization roles SHALL
additionally receive every registered application permission, while `member`
SHALL retain only its configured built-in permissions unless explicitly
extended.

#### Scenario: Owner retains organization control

- **WHEN** a user with the organization `owner` role performs an organization,
  member, or invitation action permitted by Better Auth's default `ownerAc`
- **THEN** the action SHALL remain allowed

#### Scenario: Owner or organization admin uses an application permission

- **WHEN** a user with the organization `owner` or `admin` role requests a
  resource/action pair declared in `appStatements`
- **THEN** Better Auth's permission evaluation SHALL report that pair as allowed

#### Scenario: Member lacks unassigned application permission

- **WHEN** a user with the organization `member` role requests an application
  permission not assigned to that role
- **THEN** Better Auth's permission evaluation SHALL report that pair as denied

### Requirement: Server and client plugin wiring

The system SHALL configure the server `organization()` plugin in
`packages/auth/src/index.ts` and the client `organizationClient()` plugins in
`apps/frontend/src/lib/auth-client.ts` and
`apps/frontend/src/lib/auth-server.ts` with the shared `ac` instance and
consolidated `roles` map.

#### Scenario: Client-side role permission checks stay in sync with the server

- **WHEN** the frontend checks a role permission through `organizationClient()`
- **THEN** its result SHALL match server-side Better Auth evaluation because
  both use the same `ac` and `roles` definitions
