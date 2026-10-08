import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test"
import {
  type CertificateRow,
  certificateRow,
  NOW,
  stepArgs,
} from "@nonete/db/testing"
import { type VaultScope, vault } from "#shared/vault"
import {
  P12_PASSWORD,
  type P12Fixture,
  p12Fixture,
} from "#tests/fixtures/certificate-files"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"
import { expectErrorCode } from "#tests/fixtures/errors"
import { certificateHandler } from "#v1/certificate/handler"

const context = userContext()
const USER_ID = "user-id"
const ID = "00000000-0000-4000-8000-0000000000c1"
const DAY_MS = 24 * 60 * 60 * 1000

function scope(id: string): VaultScope {
  return { kind: "certificate", id }
}

function row(overrides: Partial<CertificateRow> = {}) {
  return certificateRow({ id: ID, userId: USER_ID, ...overrides })
}

// A row whose sealed columns really hold the fixture, under the row id.
async function sealedRow(overrides: Partial<CertificateRow> = {}) {
  const dataKey = vault.newDataKey()
  return row({
    encryptedDataKey: await vault.wrapDataKey(scope(ID), dataKey),
    encryptedP12: await vault.seal(
      dataKey,
      scope(ID),
      "p12",
      await p12Fixture("rsa")
    ),
    ...overrides,
  })
}

async function file(name: P12Fixture) {
  return new File([await p12Fixture(name)], `${name}.p12`)
}

function onlyCall(op: "insert" | "update") {
  const [call] = fakeDb.calls(op)
  if (!call) throw new Error(`no ${op} call`)
  return call
}

function written(op: "insert" | "update", method: "values" | "set") {
  const [values] = stepArgs(onlyCall(op), method)
  if (typeof values !== "object" || values === null) {
    throw new Error(`no ${method} object`)
  }
  return values
}

function queryOptions(method: "findFirst" | "findMany") {
  const [call] = fakeDb.calls(`query.certificates.${method}`)
  if (!call) throw new Error(`no ${method} call`)
  const [options] = stepArgs(call, method)
  return options
}

function field(values: object, key: string): unknown {
  return Object.entries(values).find(([name]) => name === key)?.[1]
}

function bytes(value: unknown) {
  if (!(value instanceof Uint8Array)) throw new Error("expected bytes")
  return value
}

// Opens a value the handler sealed for row `id`, through its wrapped data key.
async function openSealed(
  id: string,
  values: object,
  column: "encryptedP12" | "encryptedPassword",
  purpose: "p12" | "password"
) {
  const dataKey = await vault.unwrapDataKey(
    scope(id),
    bytes(field(values, "encryptedDataKey"))
  )
  return vault.open(dataKey, scope(id), purpose, bytes(field(values, column)))
}

function writtenId(values: object) {
  const id = field(values, "id")
  if (typeof id !== "string") throw new Error("no id written")
  return id
}

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => undefined,
    (thrown: unknown) => thrown
  )
}

beforeEach(() => {
  fakeDb.reset()
  setSystemTime(NOW)
})
afterEach(() => setSystemTime())

describe("certificate.list", () => {
  test("lists the caller's active certificates with a computed status", async () => {
    fakeDb.queue("query.certificates.findMany", [
      row({ id: "a", notAfter: new Date(NOW.getTime() + 90 * DAY_MS) }),
      row({ id: "b", notAfter: new Date(NOW.getTime() + 10 * DAY_MS) }),
      row({ id: "c", notAfter: new Date(NOW.getTime() - DAY_MS) }),
    ])

    const list = await certificateHandler.list({ context })

    expect(list.map((entry) => entry.status)).toEqual([
      "valid",
      "expiring",
      "expired",
    ])
    expect(queryOptions("findMany")).toMatchObject({
      where: { userId: USER_ID, deletedAt: { isNull: true } },
      orderBy: { createdAt: "desc" },
    })
  })

  test("never returns key material", async () => {
    fakeDb.queue("query.certificates.findMany", [
      row({ encryptedPassword: Buffer.from("sealed-password") }),
    ])

    const [entry] = await certificateHandler.list({ context })

    expect(entry?.passwordRemembered).toBe(true)
    expect(Object.keys(entry ?? {})).not.toContain("encryptedP12")
    expect(Object.keys(entry ?? {})).not.toContain("encryptedPassword")
    expect(Object.keys(entry ?? {})).not.toContain("encryptedDataKey")
  })
})

describe("certificate.get", () => {
  test("returns an owned certificate", async () => {
    fakeDb.queue("query.certificates.findFirst", row())

    const certificate = await certificateHandler.get({
      context,
      input: { id: ID },
    })

    expect(certificate).toMatchObject({
      id: ID,
      alias: "Personal",
      taxId: "12345678Z",
      passwordRemembered: false,
      status: "valid",
    })
  })

  test("answers NOT_FOUND for another user's or a deleted certificate", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)

    await expectErrorCode(
      certificateHandler.get({ context, input: { id: ID } }),
      "NOT_FOUND"
    )
    expect(queryOptions("findFirst")).toEqual({
      where: { id: ID, userId: USER_ID, deletedAt: { isNull: true } },
    })
  })
})

describe("certificate.import", () => {
  async function importInput(
    overrides: Partial<{
      name: P12Fixture
      password: string
      alias: string
      rememberPassword: boolean
    }> = {}
  ) {
    return {
      file: await file(overrides.name ?? "rsa"),
      password: overrides.password ?? P12_PASSWORD,
      alias: overrides.alias,
      rememberPassword: overrides.rememberPassword ?? false,
    }
  }

  test("stores metadata and the file sealed, without the password", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)
    fakeDb.queue("insert", [row()])

    const result = await certificateHandler.import({
      context,
      input: await importInput({ alias: "FNMT personal" }),
    })

    expect(result.id).toBe(ID)
    const values = written("insert", "values")
    expect(values).toMatchObject({
      userId: USER_ID,
      alias: "FNMT personal",
      commonName: "ESPAÑOL PÉREZ JUAN - 12345678Z",
      taxId: "12345678Z",
      keyAlgorithm: "RSA",
      encryptedPassword: null,
    })
    const p12 = await p12Fixture("rsa")
    const sealed = Buffer.from(bytes(field(values, "encryptedP12")))
    expect(sealed.includes(Buffer.from(p12))).toBe(false)
    expect(
      await openSealed(writtenId(values), values, "encryptedP12", "p12")
    ).toEqual(p12)
  })

  test("defaults the alias to the holder name", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)
    fakeDb.queue("insert", [row()])

    await certificateHandler.import({ context, input: await importInput() })

    expect(written("insert", "values")).toMatchObject({
      alias: "ESPAÑOL PÉREZ JUAN - 12345678Z",
    })
  })

  test("seals the password when asked to remember it", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)
    fakeDb.queue("insert", [row()])

    await certificateHandler.import({
      context,
      input: await importInput({ rememberPassword: true }),
    })

    const values = written("insert", "values")
    const password = await openSealed(
      writtenId(values),
      values,
      "encryptedPassword",
      "password"
    )
    expect(new TextDecoder().decode(password)).toBe(P12_PASSWORD)
  })

  test("rejects a wrong password without echoing it or writing", async () => {
    const error = await rejection(
      certificateHandler.import({
        context,
        input: await importInput({ password: "my-secret-guess" }),
      })
    )

    await expectErrorCode(Promise.reject(error), "BAD_REQUEST")
    expect(String(error)).toContain(
      "La contraseña del certificado no es correcta"
    )
    expect(JSON.stringify(error)).not.toContain("my-secret-guess")
    expect(fakeDb.calls()).toEqual([])
  })

  test.each(["not-a-p12", "two-keys", "encipherment"] satisfies P12Fixture[])(
    "rejects %s with BAD_REQUEST",
    async (name) => {
      await expectErrorCode(
        certificateHandler.import({
          context,
          input: await importInput({ name }),
        }),
        "BAD_REQUEST"
      )
      expect(fakeDb.calls()).toEqual([])
    }
  )

  test("rejects an expired certificate", async () => {
    setSystemTime(new Date("2045-01-01T00:00:00.000Z"))

    await expectErrorCode(
      certificateHandler.import({ context, input: await importInput() }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls()).toEqual([])
  })

  test("rejects a certificate the caller already holds", async () => {
    fakeDb.queue("query.certificates.findFirst", row())

    await expectErrorCode(
      certificateHandler.import({ context, input: await importInput() }),
      "CONFLICT"
    )
    expect(fakeDb.calls("insert")).toEqual([])
    // Only the caller's active certificates count: another user, or a deleted
    // one, can hold the same certificate.
    expect(queryOptions("findFirst")).toMatchObject({
      where: { userId: USER_ID, deletedAt: { isNull: true } },
    })
  })

  test("maps a concurrent duplicate insert to CONFLICT", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)
    fakeDb.queueError("insert", { cause: { code: "23505" } })

    await expectErrorCode(
      certificateHandler.import({ context, input: await importInput() }),
      "CONFLICT"
    )
  })
})

describe("certificate.rename", () => {
  test("changes only the alias of an owned certificate", async () => {
    fakeDb.queue("update", [row({ alias: "Firma empresa" })])

    const result = await certificateHandler.rename({
      context,
      input: { id: ID, alias: "Firma empresa" },
    })

    expect(result.alias).toBe("Firma empresa")
    expect(written("update", "set")).toEqual({ alias: "Firma empresa" })
  })

  test("answers NOT_FOUND when nothing owned matches", async () => {
    fakeDb.queue("update", [])

    await expectErrorCode(
      certificateHandler.rename({ context, input: { id: ID, alias: "X" } }),
      "NOT_FOUND"
    )
  })
})

describe("certificate.rememberPassword", () => {
  test("verifies the password against the stored file and seals it", async () => {
    const current = await sealedRow()
    fakeDb.queue("query.certificates.findFirst", current)
    fakeDb.queue("update", [row({ encryptedPassword: Buffer.from("x") })])

    const result = await certificateHandler.rememberPassword({
      context,
      input: { id: ID, password: P12_PASSWORD },
    })

    expect(result.passwordRemembered).toBe(true)
    const password = await openSealed(
      ID,
      { ...current, ...written("update", "set") },
      "encryptedPassword",
      "password"
    )
    expect(new TextDecoder().decode(password)).toBe(P12_PASSWORD)
  })

  test("rejects a wrong password and keeps the previous state", async () => {
    fakeDb.queue("query.certificates.findFirst", await sealedRow())

    await expectErrorCode(
      certificateHandler.rememberPassword({
        context,
        input: { id: ID, password: "wrong" },
      }),
      "BAD_REQUEST"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })

  test("answers NOT_FOUND for another user's certificate", async () => {
    fakeDb.queue("query.certificates.findFirst", undefined)

    await expectErrorCode(
      certificateHandler.rememberPassword({
        context,
        input: { id: ID, password: P12_PASSWORD },
      }),
      "NOT_FOUND"
    )
    expect(fakeDb.calls("update")).toEqual([])
  })

  test("refuses a sealed file copied from another row", async () => {
    // Sealed for ID but stored on another row: the record-bound data cannot
    // open there.
    fakeDb.queue(
      "query.certificates.findFirst",
      await sealedRow({ id: "00000000-0000-4000-8000-0000000000c2" })
    )

    await expectErrorCode(
      certificateHandler.rememberPassword({
        context,
        input: { id: ID, password: P12_PASSWORD },
      }),
      "INTERNAL_SERVER_ERROR"
    )
  })
})

describe("certificate.forgetPassword", () => {
  test("erases the remembered password", async () => {
    fakeDb.queue("update", [row()])

    const result = await certificateHandler.forgetPassword({
      context,
      input: { id: ID },
    })

    expect(result.passwordRemembered).toBe(false)
    expect(written("update", "set")).toEqual({ encryptedPassword: null })
  })
})

describe("certificate.delete", () => {
  test("shreds the sealed values and soft-deletes the row", async () => {
    fakeDb.queue("update", [row({ deletedAt: NOW })])

    const result = await certificateHandler.delete({
      context,
      input: { id: ID },
    })

    expect(result).toEqual({ id: ID, success: true })
    expect(written("update", "set")).toEqual({
      encryptedDataKey: null,
      encryptedP12: null,
      encryptedPassword: null,
      deletedAt: NOW,
    })
  })

  test("answers NOT_FOUND when deleting twice", async () => {
    fakeDb.queue("update", [])

    await expectErrorCode(
      certificateHandler.delete({ context, input: { id: ID } }),
      "NOT_FOUND"
    )
  })
})
