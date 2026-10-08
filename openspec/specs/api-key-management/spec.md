# API Key Management

## Purpose

Enables the Better Auth API Key plugin so administrators can create, list, search, revoke and verify their own API keys, and so an `x-api-key` header resolves to the owning user's session.

## Requirements

### Requirement: API key plugin enabled

The system SHALL enable the Better Auth API Key plugin on both the server and the auth client, and SHALL persist API keys in the `apikey` table containing at least `configId`, `referenceId`, `key`, `enabled`, `expiresAt`, and rate-limit fields.

#### Scenario: API key schema is available

- **WHEN** the application starts with the API Key plugin configured
- **THEN** the `apikey` table SHALL exist with the fields required by the plugin, including `config_id` and `reference_id`

### Requirement: Create an API key

The system SHALL allow a globally authenticated administrator to create an API key through the `v1.apiKey.create` procedure. The request MAY specify a `name` and an `expiresIn` value in seconds; when omitted they SHALL default to `"API Key"` and 30 days. The created key SHALL belong to the requesting administrator, use the `default` configuration, and be returned with HTTP status 201. Date fields in the response (`expiresAt`, `createdAt`, `updatedAt`, `lastRefillAt`, `lastRequest`) SHALL be serialized as ISO strings or null.

#### Scenario: Administrator creates a key with defaults

- **WHEN** a user with the global `admin` role calls `v1.apiKey.create` without input
- **THEN** the system SHALL return a new API key named `"API Key"` whose `referenceId` is the administrator's user id and whose expiry is 30 days out

#### Scenario: Administrator customizes the key

- **WHEN** a user with the global `admin` role calls `v1.apiKey.create` with a `name` and `expiresIn`
- **THEN** the created key SHALL use the provided name and expire after the requested number of seconds

#### Scenario: Unauthenticated create attempt

- **WHEN** a request without a valid session calls `v1.apiKey.create`
- **THEN** the system SHALL reject it as `UNAUTHORIZED`

#### Scenario: Non-admin create attempt

- **WHEN** an authenticated user without the global `admin` role calls `v1.apiKey.create`
- **THEN** the system SHALL reject it as `FORBIDDEN`

### Requirement: Administer owned API keys

The system SHALL restrict `v1.apiKey.list`, `v1.apiKey.search`, and `v1.apiKey.delete` to globally authenticated administrators. After authorization, each operation SHALL continue to act only on API keys owned by the requesting administrator.

#### Scenario: Administrator lists or searches owned keys

- **WHEN** a user with the global `admin` role calls `v1.apiKey.list` or `v1.apiKey.search`
- **THEN** the system SHALL return only API keys owned by that administrator

#### Scenario: Administrator deletes an owned key

- **WHEN** a user with the global `admin` role calls `v1.apiKey.delete` for one of their API keys
- **THEN** the system SHALL revoke that key and report the operation result

#### Scenario: Non-admin attempts API-key administration

- **WHEN** an authenticated user without the global `admin` role calls `v1.apiKey.list`, `v1.apiKey.search`, or `v1.apiKey.delete`
- **THEN** the system SHALL reject the request as `FORBIDDEN`

#### Scenario: Anonymous caller attempts API-key administration

- **WHEN** a request without a valid session calls `v1.apiKey.list`, `v1.apiKey.search`, or `v1.apiKey.delete`
- **THEN** the system SHALL reject the request as `UNAUTHORIZED`

### Requirement: Session from API key

The system SHALL accept an API key supplied in the `x-api-key` header as a valid credential and resolve it to the owning user's session. This requires `enableSessionForAPIKeys` to be enabled on the plugin.

#### Scenario: Request authenticated with an API key

- **WHEN** a request includes a valid `x-api-key` header and no session cookie
- **THEN** session resolution SHALL return the user that owns the API key

#### Scenario: Request with an invalid API key

- **WHEN** a request includes an `x-api-key` header that does not match any enabled key
- **THEN** session resolution SHALL NOT return a user

### Requirement: API key verification

The system SHALL be able to verify an API key and report whether it is valid along with the key's metadata (excluding the raw key value).

#### Scenario: Verifying a valid key

- **WHEN** a valid key is passed to the verify operation
- **THEN** the result SHALL indicate `valid: true` and include the key's `referenceId`
