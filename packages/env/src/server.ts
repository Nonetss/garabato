import { resolve } from "node:path"
import { createEnv } from "@t3-oss/env-core"
import { config } from "dotenv"
import { z } from "zod"

// Every workspace runs with its own directory as cwd, two levels below the
// repo root, so this is the root `.env`. Containers have no such file and get
// their variables from compose; already-set variables are never overridden.
config({ path: resolve(process.cwd(), "../../.env"), quiet: true })

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().min(1),
    // Better Auth
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    // Master key that wraps the per-certificate data keys (AES-256), as the
    // base64 encoding of exactly 32 bytes. Losing it makes every stored
    // certificate unrecoverable.
    CERTIFICATE_ENCRYPTION_KEY: z
      .base64()
      .refine(
        (value) => Buffer.from(value, "base64").length === 32,
        "must decode to exactly 32 bytes"
      ),
    // S3-compatible object store for documents: the bundled MinIO
    // (http://minio:9000 in compose, http://localhost:9000 for native dev) or
    // any external service. The bucket must exist; the bundled MinIO's init
    // service creates it.
    S3_ENDPOINT: z.url(),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().min(1),
    // Also the bundled MinIO's root password, which must be ≥ 8 characters.
    S3_SECRET_ACCESS_KEY: z.string().min(8),
    // Node Environment
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Log Level
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    // Loki push endpoint (e.g. http://loki:3100) for the activity-log
    // feature. Optional — logging to console/stdout works unchanged
    // without it, and the admin log screen simply shows no data.
    LOKI_URL: z.url().optional(),
    // Admin
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    ADMIN_NAME: z.string().optional(),
    // OIDC (generic OAuth client). All three must be set to enable the
    // "oidc" sign-in provider; otherwise it's left out of the auth plugins.
    // OIDC_DISCOVERY_URL is the issuer's base URL, without the
    // /.well-known/openid-configuration suffix.
    OIDC_CLIENT_ID: z.string().min(1).optional(),
    OIDC_CLIENT_SECRET: z.string().min(1).optional(),
    OIDC_DISCOVERY_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
