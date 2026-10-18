import { afterAll, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  createModuleFiles,
  expiredInstallScript,
  MODULE_FILE_NAME,
  modulePath,
  renderInstallScript,
  WINDOWS_MODULE_FILE_NAME,
} from "#shared/token-module"

const root = mkdtempSync(join(tmpdir(), "garabato-module-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

function put(arch: string, content: string, file = MODULE_FILE_NAME) {
  mkdirSync(join(root, "dist", arch), { recursive: true })
  writeFileSync(join(root, "dist", arch, file), content)
}

describe("moduleFiles.read", () => {
  test("reads the file of an architecture with its SHA-256", async () => {
    put("x86_64", "elf-x86")

    const file = await createModuleFiles(root).read("linux", "x86_64")

    expect(new TextDecoder().decode(file?.bytes)).toBe("elf-x86")
    expect(file?.sha256).toBe(
      createHash("sha256").update("elf-x86").digest("hex")
    )
  })

  test("is null for an architecture this installation does not ship", async () => {
    expect(await createModuleFiles(root).read("linux", "aarch64")).toBeNull()
  })

  test("hashes a rebuilt file again", async () => {
    const files = createModuleFiles(root)
    put("x86_64", "first")
    await files.read("linux", "x86_64")

    put("x86_64", "second build")
    const file = await files.read("linux", "x86_64")

    expect(file?.sha256).toBe(
      createHash("sha256").update("second build").digest("hex")
    )
  })
})

describe("Windows module", () => {
  test("lives under windows-x86_64 as a DLL", async () => {
    put("windows-x86_64", "pe-dll", WINDOWS_MODULE_FILE_NAME)

    const file = await createModuleFiles(root).read("windows", "x86_64")

    expect(new TextDecoder().decode(file?.bytes)).toBe("pe-dll")
  })

  test("does not exist for ARM", async () => {
    expect(modulePath("windows", "aarch64")).toBeNull()
    expect(await createModuleFiles(root).read("windows", "aarch64")).toBeNull()
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

  test("keeps dollar sequences of the uninstall script as they are", () => {
    const uninstall = "if ($_ -notmatch '^x$') { $& $1 $` }"

    expect(
      renderInstallScript(
        template,
        uninstall,
        "https://garabato.lan",
        "7KQ4XMPA"
      )
    ).toContain(uninstall)
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
      "linux",
      "https://garabato.lan",
      "7KQ4XMPA"
    )

    expect(script).not.toContain("@@")
    expect(script).toContain("GARABATO_URL='https://garabato.lan'")
    expect(script).toContain("INSTALL_CODE='7KQ4XMPA'")
    expect(script).toContain("modutil -dbdir")
  })

  test("the PowerShell script renders without any placeholder left", async () => {
    const script = await createModuleFiles(native).installScript(
      "windows",
      "https://garabato.lan",
      "7KQ4XMPA"
    )

    expect(script).not.toContain("@@")
    expect(script).toContain("$GarabatoUrl = 'https://garabato.lan'")
    expect(script).toContain("$InstallCode = '7KQ4XMPA'")
    expect(script).toContain("function Uninstall-GarabatoToken")
  })

  test("the expired scripts only print", () => {
    expect(expiredInstallScript("linux")).toContain("exit 1")
    expect(expiredInstallScript("linux")).not.toContain("curl")
    const windows = expiredInstallScript("windows")
    expect(windows).toContain("ha caducado")
    // It runs in the user's console through iex: exit would close it.
    expect(windows).not.toContain("exit")
    expect(windows).not.toContain("Invoke-")
  })
})
