## ADDED Requirements

### Requirement: Automatic page-view logging

The system SHALL emit a structured log entry for every authenticated,
non-prefetch GET navigation that requests an HTML page from the Astro SSR
frontend, without requiring per-page opt-in and independently of whether the
requested path contains a dot. The entry SHALL include the user's id,
requested path, and timestamp.

#### Scenario: Authenticated user navigates to a page

- **WHEN** an authenticated browser performs a non-prefetch GET document
  navigation
- **THEN** the system SHALL emit a log entry identifying the user, path, and
  time of the navigation

#### Scenario: Astro client navigation requests HTML

- **WHEN** an authenticated non-prefetch GET request has no fetch destination
  header but accepts HTML
- **THEN** the system SHALL treat the request as a page navigation and emit a
  page-view log

#### Scenario: Page path contains a dot

- **WHEN** an authenticated user navigates to a valid dynamic page whose route
  value contains a dot
- **THEN** the system SHALL emit a page-view log for that navigation

#### Scenario: Static asset requests are not logged as page views

- **WHEN** a request targets a non-document destination or does not accept HTML
- **THEN** the system SHALL NOT emit a page-view log for it, regardless of
  whether its path has a file extension

#### Scenario: Speculative request is not logged

- **WHEN** a browser marks a request as prefetch through `Sec-Purpose` or
  `Purpose`
- **THEN** the system SHALL NOT emit a page-view log for it

### Requirement: Automatic API-call logging

The system SHALL emit a structured log entry for every API/oRPC call made
by an authenticated user, without requiring per-endpoint opt-in, including
the user's id, the HTTP method, the request path, the response status
code, and a timestamp.

#### Scenario: Authenticated user calls an API endpoint

- **WHEN** an authenticated user's request reaches an oRPC procedure
  through `/rpc/*` or `/api/*`
- **THEN** the system SHALL emit a log entry identifying the user, method,
  path, response status, and the time of the call

#### Scenario: Internal and documentation routes are excluded

- **WHEN** a request targets Better Auth's own routes (`/api/auth/*`) or
  the documentation routes (`/scalar`, `/openapi.json`)
- **THEN** the system SHALL NOT emit an API-call log entry for it

### Requirement: Unauthenticated traffic is not logged

The system SHALL NOT emit page-view or API-call log entries for requests
that have no authenticated user, since there is no user to attribute the
entry to.

#### Scenario: Anonymous request

- **WHEN** a request (page navigation or API call) is made without a valid
  authenticated session
- **THEN** the system SHALL NOT emit a page-view or API-call log entry for
  it

### Requirement: Logging degrades gracefully without Loki configured

The system SHALL function normally, and SHALL NOT fail or delay any page
navigation or API call, when no Loki endpoint is configured or when Loki is
unreachable.

#### Scenario: No Loki endpoint configured

- **WHEN** the application starts without a Loki URL configured
- **THEN** page navigation and API calls SHALL continue to work exactly as
  without this feature, and the administrative log screen SHALL show no
  data instead of erroring

#### Scenario: Loki is unreachable at write time

- **WHEN** the application attempts to emit a log entry and the configured
  Loki endpoint is unreachable
- **THEN** the triggering page navigation or API call SHALL still complete
  successfully for the user

### Requirement: Administrator log query

The system SHALL let administrators query indexed page-view and API-call
log entries, filterable by user, event type, path, and date range, without
exposing the underlying log store directly to the browser.

#### Scenario: Administrator filters activity by user

- **WHEN** an administrator queries the activity log filtered by a
  specific user
- **THEN** the system SHALL return only log entries attributed to that
  user

#### Scenario: Administrator filters activity by event type and date range

- **WHEN** an administrator queries the activity log filtered by event
  type (page view or API call) and a date range
- **THEN** the system SHALL return only matching log entries within that
  range

#### Scenario: Browser never talks to the log store directly

- **WHEN** the administrative log screen requests log data
- **THEN** the request SHALL go through the application's own
  administrator-gated API, never directly to the underlying log store

### Requirement: Non-admin access is denied

The system SHALL deny access to the activity log query API and the
administrative log screen for users without the `admin` role.

#### Scenario: Non-admin requests activity log data

- **WHEN** a user without the `admin` role requests activity log data or
  the `/admin/logs` route
- **THEN** the system SHALL deny access

### Requirement: Log retention

The system SHALL automatically discard indexed page-view and API-call log
entries older than 30 days.

#### Scenario: Entry older than the retention window

- **WHEN** a log entry is older than 30 days
- **THEN** the system SHALL no longer retain or return it in query results
