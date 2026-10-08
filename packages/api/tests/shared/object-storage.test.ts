import { describe, expect, test } from "bun:test"
import {
  createObjectStorage,
  type ObjectStoreClient,
} from "#shared/object-storage"
import { expectErrorCode } from "#tests/fixtures/errors"

function s3Error(code: string) {
  return Object.assign(new Error("S3 failure"), { name: "S3Error", code })
}

function failingClient(error: unknown): ObjectStoreClient {
  return {
    write: () => Promise.reject(error),
    file: () => ({ arrayBuffer: () => Promise.reject(error) }),
    delete: () => Promise.reject(error),
  }
}

describe("createObjectStorage", () => {
  test("stores and reads bytes through the client", async () => {
    const objects = new Map<string, Uint8Array<ArrayBuffer>>()
    const storage = createObjectStorage({
      write: async (key, data) => {
        objects.set(key, data)
        return data.length
      },
      file: (key) => ({
        arrayBuffer: async () => {
          const bytes = objects.get(key)
          if (!bytes) throw s3Error("NoSuchKey")
          return bytes.buffer
        },
      }),
      delete: async (key) => {
        objects.delete(key)
      },
    })

    await storage.putObject("a", Uint8Array.of(1, 2, 3))
    expect(await storage.getObject("a")).toEqual(Uint8Array.of(1, 2, 3))
    await storage.deleteObject("a")
    expect(objects.size).toBe(0)
  })

  test.each(["ConnectionRefused", "ECONNRESET", "FailedToOpenSocket"])(
    "maps an unreachable store (%s) to SERVICE_UNAVAILABLE",
    async (code) => {
      const storage = createObjectStorage(failingClient(s3Error(code)))

      await expectErrorCode(
        storage.putObject("a", Uint8Array.of(1)),
        "SERVICE_UNAVAILABLE"
      )
    }
  )

  test.each(["NoSuchBucket", "AccessDenied", "NoSuchKey"])(
    "maps a store error answer (%s) to BAD_GATEWAY",
    async (code) => {
      const storage = createObjectStorage(failingClient(s3Error(code)))

      await expectErrorCode(storage.getObject("a"), "BAD_GATEWAY")
      await expectErrorCode(storage.deleteObject("a"), "BAD_GATEWAY")
    }
  )

  test("treats an error without a code as unreachable", async () => {
    const storage = createObjectStorage(failingClient(new Error("boom")))

    await expectErrorCode(storage.getObject("a"), "SERVICE_UNAVAILABLE")
  })
})
