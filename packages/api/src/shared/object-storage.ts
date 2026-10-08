import { errors } from "#errors"

/**
 * The slice of Bun's `S3Client` the API uses, so tests can inject a fake or
 * a failing client.
 */
export type ObjectStoreClient = {
  write: (key: string, data: Uint8Array<ArrayBuffer>) => Promise<number>
  file: (key: string) => { arrayBuffer: () => Promise<ArrayBuffer> }
  delete: (key: string) => Promise<void>
}

export type ObjectStorage = {
  putObject: (key: string, bytes: Uint8Array<ArrayBuffer>) => Promise<void>
  getObject: (key: string) => Promise<Uint8Array<ArrayBuffer>>
  deleteObject: (key: string) => Promise<void>
}

const UNAVAILABLE_MESSAGE =
  "El almacenamiento de documentos no está disponible; inténtalo de nuevo más tarde"
const STORE_ERROR_MESSAGE =
  "El almacenamiento de documentos ha devuelto un error"

// Bun reports every failure as an `S3Error`; its `code` tells a store that
// cannot be reached (ConnectionRefused, ECONNRESET, FailedToOpenSocket...)
// from one that answered with an error (NoSuchBucket, AccessDenied...).
const UNREACHABLE_CODE = /^(Connection|E[A-Z]+$|FailedToOpenSocket|DNS|Timeout)/

function codeOf(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined
  }
  if (typeof error.code !== "string") return undefined
  return error.code
}

/** Maps a client failure to the API error the caller should see. */
export function storageError(error: unknown) {
  const code = codeOf(error)
  if (code === undefined || UNREACHABLE_CODE.test(code)) {
    return errors.SERVICE_UNAVAILABLE({ message: UNAVAILABLE_MESSAGE })
  }
  return errors.BAD_GATEWAY({ message: STORE_ERROR_MESSAGE })
}

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw storageError(error)
  }
}

/** Object storage over an S3-compatible client, with API-shaped errors. */
export function createObjectStorage(client: ObjectStoreClient): ObjectStorage {
  return {
    putObject: async (key, bytes) => {
      await guarded(() => client.write(key, bytes))
    },
    getObject: (key) =>
      guarded(async () => new Uint8Array(await client.file(key).arrayBuffer())),
    deleteObject: (key) => guarded(() => client.delete(key)),
  }
}
