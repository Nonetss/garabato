import type { ObjectStorage } from "#shared/object-storage"

type Operation = "putObject" | "getObject" | "deleteObject"

/**
 * In-memory stand-in for `#lib/object-storage`, installed by `tests/setup.ts`.
 * Tests inspect `objects`, and make the next call of an operation fail with
 * `failNext` (pass an `ORPCError` to simulate what the real module throws).
 */
function createFakeObjectStorage() {
  const objects = new Map<string, Uint8Array<ArrayBuffer>>()
  const failures = new Map<Operation, unknown>()

  function takeFailure(operation: Operation) {
    if (!failures.has(operation)) return
    const failure = failures.get(operation)
    failures.delete(operation)
    throw failure
  }

  const storage: ObjectStorage = {
    putObject: async (key, bytes) => {
      takeFailure("putObject")
      objects.set(key, new Uint8Array(bytes))
    },
    getObject: async (key) => {
      takeFailure("getObject")
      const bytes = objects.get(key)
      if (!bytes) throw new Error(`fake object storage: no object "${key}"`)
      return new Uint8Array(bytes)
    },
    deleteObject: async (key) => {
      takeFailure("deleteObject")
      objects.delete(key)
    },
  }

  return {
    storage,
    objects,
    failNext: (operation: Operation, error: unknown) => {
      failures.set(operation, error)
    },
    reset: () => {
      objects.clear()
      failures.clear()
    },
  }
}

export const fakeObjectStorage = createFakeObjectStorage()
