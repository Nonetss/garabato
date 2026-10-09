import { describe, expect, test } from "bun:test"
import {
  previousVersion,
  shownVersion,
  versionParamCodec,
  viewedVersionNumber,
} from "@/features/documents/detail/model/version-view"
import type { DocumentVersion } from "@/features/documents/shared"

function version(number: number, kind: DocumentVersion["kind"] = "upload") {
  return {
    id: `00000000-0000-4000-8000-00000000000${number}`,
    number,
    kind,
    sizeBytes: 1024,
    sha256: "0".repeat(64),
    createdAt: "2026-10-09T10:00:00.000Z",
  }
}

// Version 3 was deleted: numbers are never reused, so the list has a gap.
const versions = [version(1), version(2, "pages"), version(4, "signature")]

describe("versionParamCodec", () => {
  test("reads positive whole numbers and ignores anything else", () => {
    expect(versionParamCodec.parse("2")).toBe(2)
    expect(versionParamCodec.parse("0")).toBeNull()
    expect(versionParamCodec.parse("-1")).toBeNull()
    expect(versionParamCodec.parse("1.5")).toBeNull()
    expect(versionParamCodec.parse("v2")).toBeNull()
    expect(versionParamCodec.serialize(3)).toBe("3")
  })
})

describe("shownVersion", () => {
  test("shows the current version when none is requested", () => {
    expect(shownVersion(versions, null)?.number).toBe(4)
  })

  test("shows the requested live version", () => {
    expect(shownVersion(versions, 1)?.number).toBe(1)
  })

  test("falls back to the current one for a deleted or unknown version", () => {
    expect(shownVersion(versions, 3)?.number).toBe(4)
    expect(shownVersion(versions, 9)?.number).toBe(4)
  })

  test("shows nothing for a document without versions", () => {
    expect(shownVersion([], 1)).toBeUndefined()
  })
})

describe("viewedVersionNumber", () => {
  test("fetches the current version without a number", () => {
    expect(viewedVersionNumber(versions, null)).toBeUndefined()
    expect(viewedVersionNumber(versions, 4)).toBeUndefined()
    expect(viewedVersionNumber(versions, 3)).toBeUndefined()
  })

  test("fetches an earlier version by its number", () => {
    expect(viewedVersionNumber(versions, 2)).toBe(2)
  })

  test("fetches the current version while the document is loading", () => {
    expect(viewedVersionNumber(undefined, 2)).toBeUndefined()
  })
})

describe("previousVersion", () => {
  test("names the version that becomes current after a deletion", () => {
    expect(previousVersion(versions)?.number).toBe(2)
    expect(previousVersion([version(1)])).toBeUndefined()
  })
})
