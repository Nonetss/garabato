import { beforeEach, describe, expect, test } from "bun:test"
import { browserTokenSettingsRow, stepArgs } from "@nonete/db/testing"
import {
  compareVersions,
  isOutdated,
  moduleIdentityOf,
  readSwitches,
  writeSwitches,
} from "#shared/token-settings"
import { fakeDb } from "#tests/fixtures/db"

beforeEach(() => fakeDb.reset())

describe("readSwitches", () => {
  test("enables everything when no settings were saved", async () => {
    fakeDb.queue("query.browserTokenSettings.findFirst", undefined)

    expect(await readSwitches()).toEqual({
      tokenEnabled: true,
      installsEnabled: true,
      minModuleVersion: null,
    })
  })

  test("returns the saved switches", async () => {
    fakeDb.queue(
      "query.browserTokenSettings.findFirst",
      browserTokenSettingsRow({
        tokenEnabled: false,
        minModuleVersion: "0.2.0",
      })
    )

    expect(await readSwitches()).toEqual({
      tokenEnabled: false,
      installsEnabled: true,
      minModuleVersion: "0.2.0",
    })
  })
})

describe("writeSwitches", () => {
  test("upserts the only row with who changed it", async () => {
    fakeDb.queue("insert", [])

    await writeSwitches(
      { tokenEnabled: false, installsEnabled: true, minModuleVersion: null },
      "admin-id"
    )

    const [insert] = fakeDb.calls("insert")
    expect(insert && stepArgs(insert, "values")[0]).toMatchObject({
      id: "default",
      tokenEnabled: false,
      installsEnabled: true,
      minModuleVersion: null,
      updatedBy: "admin-id",
    })
  })
})

describe("versions", () => {
  test("compare each component as a number", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0)
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0)
    expect(compareVersions("0.1.0", "0.2.0")).toBeLessThan(0)
  })

  test("are outdated only below a minimum", () => {
    expect(isOutdated("0.1.0", "0.2.0")).toBe(true)
    expect(isOutdated("0.2.0", "0.2.0")).toBe(false)
    expect(isOutdated("0.1.0", null)).toBe(false)
  })
})

describe("moduleIdentityOf", () => {
  test("reads version and platform", () => {
    const headers = new Headers({ "x-garabato-module": "0.2.0 windows-x86_64" })

    expect(moduleIdentityOf(headers)).toEqual({
      version: "0.2.0",
      platform: "windows-x86_64",
    })
  })

  test("treats a missing or malformed header as the legacy module", () => {
    expect(moduleIdentityOf(new Headers())).toEqual({
      version: "0.1.0",
      platform: "unknown",
    })
    expect(
      moduleIdentityOf(new Headers({ "x-garabato-module": "latest" }))
    ).toEqual({ version: "0.1.0", platform: "unknown" })
  })
})
