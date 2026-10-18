import { describe, expect, test } from "bun:test"
import {
  type BrowserGroup,
  browsersBelow,
  compareVersions,
  confirmationFor,
  type SwitchValues,
} from "@/features/admin/browser-token/model/settings"

const groups: BrowserGroup[] = [
  { version: "0.2.0", platform: "linux-x86_64", count: 3, outdated: false },
  { version: "0.1.0", platform: "unknown", count: 1, outdated: false },
]

const enabled: SwitchValues = {
  tokenEnabled: true,
  installsEnabled: true,
  minModuleVersion: null,
}

describe("compareVersions", () => {
  test("compares each component as a number", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0)
    expect(compareVersions("0.2.0", "0.2.0")).toBe(0)
  })
})

describe("browsersBelow", () => {
  test("counts the browsers a minimum leaves out", () => {
    expect(browsersBelow(groups, "0.2.0")).toBe(1)
    expect(browsersBelow(groups, "0.3.0")).toBe(4)
    expect(browsersBelow(groups, null)).toBe(0)
  })
})

describe("confirmationFor", () => {
  test("turning the token off names every connected browser", () => {
    const confirmation = confirmationFor(
      enabled,
      { ...enabled, tokenEnabled: false },
      groups
    )

    expect(confirmation?.description).toContain("4 navegadores conectados")
  })

  test("turning installs off says installed browsers keep working", () => {
    expect(
      confirmationFor(enabled, { ...enabled, installsEnabled: false }, groups)
        ?.description
    ).toContain("seguirán funcionando")
  })

  test("raising the minimum counts the browsers it cuts off", () => {
    const confirmation = confirmationFor(
      enabled,
      { ...enabled, minModuleVersion: "0.2.0" },
      groups
    )

    expect(confirmation?.title).toBe("Exigir el módulo 0.2.0")
    expect(confirmation?.description).toContain("1 navegador conectado")
  })

  test("asks nothing for a change that restores or relaxes", () => {
    const off = { ...enabled, tokenEnabled: false, minModuleVersion: "0.2.0" }

    expect(
      confirmationFor(off, { ...off, tokenEnabled: true }, groups)
    ).toBeNull()
    expect(
      confirmationFor(off, { ...off, minModuleVersion: null }, groups)
    ).toBeNull()
  })
})
