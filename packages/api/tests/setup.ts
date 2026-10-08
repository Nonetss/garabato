import { mock } from "bun:test"

import { fakeDb } from "#tests/fixtures/db"

/**
 * Preloaded before every test file (`bunfig.toml`). Importing the procedure
 * builders pulls in `@nonete/auth` and `@nonete/db`, which validate
 * `@nonete/env/server` on import. These values satisfy that validation and
 * are overwritten, not defaulted: turbo passes the shell's real env through,
 * and a unit test must never reach a real database or integration.
 */
const placeholders = {
  NODE_ENV: "test",
  // Port 1 on loopback refuses connections; the pg pool connects lazily, so
  // nothing dials it unless a test runs a query.
  DATABASE_URL: "postgres://unit-test:unit-test@127.0.0.1:1/unit_test",
  BETTER_AUTH_SECRET: "unit-test-secret-at-least-32-characters-long",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:4321",
  // 32 bytes of 0x01: a fixed vault master key, so sealed values are
  // reproducible across runs.
  CERTIFICATE_ENCRYPTION_KEY: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
}

/**
 * Optional vars that switch on external integrations or skip validation.
 * Set to "" rather than deleted: `@nonete/env/server` loads the root `.env`
 * with dotenv, which refills unset vars but never overrides a set one, and
 * `emptyStringAsUndefined` then reads "" as unset.
 */
const cleared = [
  "SKIP_ENV_VALIDATION",
  "LOKI_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "ADMIN_NAME",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_DISCOVERY_URL",
]

Object.assign(process.env, placeholders)
for (const name of cleared) process.env[name] = ""

// `mock.module` holds for the whole run, so `@nonete/db` is replaced once,
// here, with the shared fake; a per-file mock would leak into other files.
mock.module("@nonete/db", () => ({
  db: fakeDb.db,
  createDb: () => fakeDb.db,
  closeDb: async () => {},
}))
