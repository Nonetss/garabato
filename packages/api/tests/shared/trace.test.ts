import { beforeEach, describe, expect, test } from "bun:test"
import { stepArgs } from "@nonete/db/testing"
import { writeTraces } from "@nonete/db/trace-writer"
import type { Context } from "#context"
import { recordTraces } from "#shared/trace"
import { userContext } from "#tests/fixtures/context"
import { fakeDb } from "#tests/fixtures/db"

beforeEach(() => fakeDb.reset())

describe("recordTraces", () => {
  test("writes one row per trace with the caller and the client IP", async () => {
    const context: Context = {
      ...userContext(),
      headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
    }
    fakeDb.queue("insert", [])

    await recordTraces(fakeDb.db, context, "user-1", [
      { type: "certificate.imported", certificateId: "cert-1" },
      {
        type: "document.renamed",
        documentId: "doc-1",
        details: { from: "a.pdf", to: "b.pdf" },
      },
    ])

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toEqual([
      {
        userId: "user-1",
        type: "certificate.imported",
        documentId: undefined,
        certificateId: "cert-1",
        versionId: undefined,
        ipAddress: "203.0.113.7",
        details: undefined,
      },
      {
        userId: "user-1",
        type: "document.renamed",
        documentId: "doc-1",
        certificateId: undefined,
        versionId: undefined,
        ipAddress: "203.0.113.7",
        details: { from: "a.pdf", to: "b.pdf" },
      },
    ])
  })

  test("stores a null IP when the request carries none", async () => {
    fakeDb.queue("insert", [])

    await recordTraces(fakeDb.db, userContext(), "user-1", [
      { type: "certificate.deleted", certificateId: "cert-1" },
    ])

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject([
      { ipAddress: null },
    ])
  })

  test("writes nothing for an empty list", async () => {
    await recordTraces(fakeDb.db, userContext(), "user-1", [])

    expect(fakeDb.calls("insert")).toEqual([])
  })
})

describe("writeTraces", () => {
  test("writes the rows with the IP it is given", async () => {
    fakeDb.queue("insert", [])

    await writeTraces(fakeDb.db, "user-1", "192.0.2.9", [
      { type: "account.signedOut" },
    ])

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toEqual([
      expect.objectContaining({
        userId: "user-1",
        type: "account.signedOut",
        ipAddress: "192.0.2.9",
      }),
    ])
  })

  test("writes nothing for no traces", async () => {
    await writeTraces(fakeDb.db, "user-1", null, [])

    expect(fakeDb.calls("insert")).toEqual([])
  })
})
