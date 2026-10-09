## MODIFIED Requirements

### Requirement: Validated server environment

`@nonete/env/server` SHALL validate the server variables with t3-env and zod and export them as a typed `env` object: `DATABASE_URL` (required), `BETTER_AUTH_SECRET` (required, at least 32 characters), `BETTER_AUTH_URL` (required URL), `CORS_ORIGIN` (required URL), `CERTIFICATE_ENCRYPTION_KEY` (required, the base64 encoding of exactly 32 bytes), `S3_ENDPOINT` (required URL of the S3-compatible object store), `S3_BUCKET` (required), `S3_ACCESS_KEY_ID` (required), `S3_SECRET_ACCESS_KEY` (required, at least 8 characters), `S3_REGION` (default `us-east-1`), `DISABLE_SIGN_UP` (boolean written as `true`/`false`, default `false`), `NODE_ENV` (`development` | `production` | `test`, default `development`), `LOG_LEVEL` (`fatal` | `error` | `warn` | `info` | `debug` | `trace`, default `info`), and the optional `LOKI_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 8 characters), `ADMIN_NAME`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_DISCOVERY_URL`. Empty strings SHALL be treated as unset. Validation SHALL be skipped when `SKIP_ENV_VALIDATION` is set. `@nonete/env/web` SHALL validate the client variable `PUBLIC_SERVER_URL`.

#### Scenario: Missing required variable

- **WHEN** the backend starts without `BETTER_AUTH_SECRET` and without `SKIP_ENV_VALIDATION`
- **THEN** environment validation SHALL fail and the backend SHALL NOT start

#### Scenario: Malformed certificate encryption key

- **WHEN** the backend starts with a `CERTIFICATE_ENCRYPTION_KEY` that is not valid base64 or does not decode to exactly 32 bytes, and without `SKIP_ENV_VALIDATION`
- **THEN** environment validation SHALL fail and the backend SHALL NOT start

#### Scenario: Missing object storage

- **WHEN** the backend starts without `S3_ENDPOINT` or `S3_BUCKET`, and without `SKIP_ENV_VALIDATION`
- **THEN** environment validation SHALL fail and the backend SHALL NOT start

#### Scenario: Defaults apply

- **WHEN** neither `NODE_ENV`, `LOG_LEVEL`, `S3_REGION` nor `DISABLE_SIGN_UP` is set
- **THEN** `env.NODE_ENV` SHALL be `development`, `env.LOG_LEVEL` SHALL be `info`, `env.S3_REGION` SHALL be `us-east-1` and `env.DISABLE_SIGN_UP` SHALL be `false`

#### Scenario: Sign-up disabled by configuration

- **WHEN** the backend starts with `DISABLE_SIGN_UP=true`
- **THEN** `env.DISABLE_SIGN_UP` SHALL be `true`

#### Scenario: Malformed boolean

- **WHEN** the backend starts with `DISABLE_SIGN_UP` set to a value that is not a recognised boolean (for example `maybe`), and without `SKIP_ENV_VALIDATION`
- **THEN** environment validation SHALL fail and the backend SHALL NOT start

#### Scenario: Build without secrets

- **WHEN** a production image is built with `SKIP_ENV_VALIDATION=1` and no runtime variables
- **THEN** the build SHALL NOT fail on environment validation
