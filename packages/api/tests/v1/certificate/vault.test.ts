import { describe, expect, test } from "bun:test"
import { createVault, VaultError, vault } from "#v1/certificate/vault"

const id = "00000000-0000-4000-8000-0000000000c1"
const otherId = "00000000-0000-4000-8000-0000000000c2"
const payload = new TextEncoder().encode("PKCS#12 bytes")

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => undefined,
    (thrown: unknown) => thrown
  )
}

describe("vault", () => {
  test("round-trips a data key and a sealed value", async () => {
    const dataKey = vault.newDataKey()
    const wrapped = await vault.wrapDataKey(id, dataKey)
    const unwrapped = await vault.unwrapDataKey(id, wrapped)
    const sealed = await vault.seal(unwrapped, id, "p12", payload)

    expect(unwrapped).toEqual(dataKey)
    expect(await vault.open(dataKey, id, "p12", sealed)).toEqual(payload)
  })

  test("never stores the plaintext and uses a fresh iv each time", async () => {
    const dataKey = vault.newDataKey()
    const first = await vault.seal(dataKey, id, "p12", payload)
    const second = await vault.seal(dataKey, id, "p12", payload)

    expect(first.includes(Buffer.from(payload))).toBe(false)
    expect(first).not.toEqual(second)
    expect(first[0]).toBe(1)
  })

  test("refuses a value sealed for another record", async () => {
    const dataKey = vault.newDataKey()
    const sealed = await vault.seal(dataKey, id, "p12", payload)

    expect(
      await rejection(vault.open(dataKey, otherId, "p12", sealed))
    ).toBeInstanceOf(VaultError)
    expect(
      await rejection(
        vault.unwrapDataKey(otherId, await vault.wrapDataKey(id, dataKey))
      )
    ).toBeInstanceOf(VaultError)
  })

  test("refuses a value sealed for another purpose", async () => {
    const dataKey = vault.newDataKey()
    const sealed = await vault.seal(dataKey, id, "password", payload)

    expect(
      await rejection(vault.open(dataKey, id, "p12", sealed))
    ).toBeInstanceOf(VaultError)
  })

  test("refuses tampered bytes", async () => {
    const dataKey = vault.newDataKey()
    const sealed = await vault.seal(dataKey, id, "p12", payload)
    const lastIndex = sealed.length - 1
    sealed[lastIndex] = (sealed[lastIndex] ?? 0) ^ 0x01

    expect(
      await rejection(vault.open(dataKey, id, "p12", sealed))
    ).toBeInstanceOf(VaultError)
  })

  test("refuses an unknown format version", async () => {
    const dataKey = vault.newDataKey()
    const sealed = await vault.seal(dataKey, id, "p12", payload)
    sealed[0] = 2

    expect(
      await rejection(vault.open(dataKey, id, "p12", sealed))
    ).toBeInstanceOf(VaultError)
  })

  test("refuses data keys wrapped under another master key", async () => {
    const other = createVault(Buffer.alloc(32, 2).toString("base64"))
    const wrapped = await other.wrapDataKey(id, vault.newDataKey())

    expect(await rejection(vault.unwrapDataKey(id, wrapped))).toBeInstanceOf(
      VaultError
    )
  })

  test("rejects a master key that is not 32 bytes", () => {
    expect(() => createVault(Buffer.alloc(16).toString("base64"))).toThrow(
      VaultError
    )
  })
})
