import { env } from "@nonete/env/server"
import { S3Client } from "bun"
import { createObjectStorage } from "#shared/object-storage"

/**
 * The document store: the bundled MinIO or any S3-compatible service set in
 * `S3_*`. Unit tests replace this module with an in-memory fake
 * (`tests/setup.ts`).
 */
export const objectStorage = createObjectStorage(
  new S3Client({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  })
)
