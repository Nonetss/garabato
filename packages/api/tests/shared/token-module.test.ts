import { afterAll, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  createModuleFiles,
  expiredInstallScript,
  MODULE_FILE_NAME,
  renderInstallScript,
} from "#shared/token-module"

const root = mkdtempSync(join(tmpdir(), "garabato-module-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

function put(arch: string, content: string) {
  mkdirSync(join(root, "dist", arch), { recursive: true })
  writeFileSync(join(root, "dist", arch, MODULE_FILE_NAME), content)
}

describe("moduleFiles.read", () => {
  test("reads the file of an architecture with its SHA-256", async () => {
    put("x86_64", "elf-x86")

    const file = await createModuleFiles(root).read("x86_64")

    expect(new TextDecoder().decode(file?.bytes)).toBe("elf-x86")
    expect(file?.sha256).toBe(
      createHash("sha256").update("elf-x86").digest("hex")
    )
  })

  test("is null for an architecture this installation does not ship", async () => {
    expect(await createModuleFiles(root).read("aarch64")).toBeNull()
  })

  test("hashes a rebuilt file again", async () => {
    const files = createModuleFiles(root)
    put("x86_64", "first")
    await files.read("x86_64")

    put("x86_64", "second build")
    const file = await files.read("x86_64")

    expect(file?.sha256).toBe(
      createHash("sha256").update("second build").digest("hex")
    )
  })
})

describe("renderInstallScript", () => {
  const template = "U='@@URL@@'\nC='@@CODE@@'\ncat <<'X'\n@@UNINSTALL@@\nX\n"

  test("fills in the address, the code and the uninstall script", () => {
    expect(
      renderInstallScript(
        template,
        "rm -f x\n",
        "https://garabato.lan",
        "7KQ4XMPA"
      )
    ).toBe("U='https://garabato.lan'\nC='7KQ4XMPA'\ncat <<'X'\nrm -f x\nX\n")
  })

  test("refuses an address that could break out of the quotes", () => {
    expect(() =>
      renderInstallScript(template, "", "https://x'; rm -rf ~; '", "7KQ4XMPA")
    ).toThrow()
    expect(() =>
      renderInstallScript(template, "", "https://$(id)", "7KQ4XMPA")
    ).toThrow()
  })

  test("refuses a code that is not canonical", () => {
    expect(() =>
      renderInstallScript(template, "", "https://garabato.lan", "7kq4-xmpa")
    ).toThrow()
  })
})

describe("the repository's scripts", () => {
  const native = resolve(import.meta.dir, "../../../../native/pkcs11")

  test("render without any placeholder left", async () => {
    const script = await createModuleFiles(native).installScript(
      "https://garabato.lan",
      "7KQ4XMPA"
    )

    expect(script).not.toContain("@@")
    expect(script).toContain("GARABATO_URL='https://garabato.lan'")
    expect(script).toContain("INSTALL_CODE='7KQ4XMPA'")
    expect(script).toContain("modutil -dbdir")
  })

  test("the expired script only prints and fails", () => {
    expect(expiredInstallScript()).toContain("exit 1")
    expect(expiredInstallScript()).not.toContain("curl")
  })
})
