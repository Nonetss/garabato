import { describe, expect, test } from "bun:test"
import {
  detectInstallSystem,
  installsAllowed,
  remainingLabel,
} from "@/features/certificates/overview/model/browser-tokens"

const EXPIRES = "2026-01-01T10:10:00.000Z"

describe("remainingLabel", () => {
  test("shows minutes and zero-padded seconds", () => {
    expect(
      remainingLabel(EXPIRES, Date.parse("2026-01-01T10:00:00.000Z"))
    ).toBe("10:00")
    expect(
      remainingLabel(EXPIRES, Date.parse("2026-01-01T10:09:51.500Z"))
    ).toBe("0:09")
  })

  test("stops at zero once the code expired", () => {
    expect(
      remainingLabel(EXPIRES, Date.parse("2026-01-01T10:12:00.000Z"))
    ).toBe("0:00")
  })
})

describe("detectInstallSystem", () => {
  test("picks Windows on a Windows browser", () => {
    expect(
      detectInstallSystem(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0"
      )
    ).toBe("windows")
  })

  test("picks Linux elsewhere", () => {
    expect(
      detectInstallSystem(
        "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0"
      )
    ).toBe("linux")
    expect(detectInstallSystem("")).toBe("linux")
  })
})

describe("installsAllowed", () => {
  const switches = {
    tokenEnabled: true,
    installsEnabled: true,
    minModuleVersion: null,
    servedVersion: "0.2.0",
  }

  test("needs the token and installs on", () => {
    expect(installsAllowed(switches)).toBe(true)
    expect(installsAllowed({ ...switches, installsEnabled: false })).toBe(false)
    expect(installsAllowed({ ...switches, tokenEnabled: false })).toBe(false)
  })

  test("allows while the switches are loading", () => {
    expect(installsAllowed(undefined)).toBe(true)
  })
})
