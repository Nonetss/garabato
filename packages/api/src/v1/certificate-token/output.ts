import { z } from "zod"

// Never the key value: only the install script gets it, from `redeem`.
const tokenKey = z.object({
  id: z.string(),
  name: z.string().describe("Name of the browser"),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z
    .string()
    .nullable()
    .describe("Last time the browser module reached Garabato"),
})

export type TokenKeySummary = z.infer<typeof tokenKey>

const switches = {
  tokenEnabled: z.boolean(),
  installsEnabled: z.boolean(),
  minModuleVersion: z.string().nullable(),
  servedVersion: z.string().describe("Module version the installers hand out"),
}

const settings = z.object({
  ...switches,
  updatedAt: z.string().nullable(),
  updatedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  browsers: z
    .array(
      z.object({
        version: z.string(),
        platform: z.string(),
        count: z.number().int(),
        outdated: z.boolean(),
      })
    )
    .describe(
      "Connected browsers of every user by module version and platform"
    ),
})

export const certificateTokenOutput = {
  startConnection: z.object({
    code: z.string().describe("Install code, canonical form"),
    displayCode: z.string().describe("Install code as shown, e.g. 7KQ4-XMPA"),
    commands: z
      .object({
        linux: z.string().describe("Shell command (curl … | sh)"),
        windows: z.string().describe("PowerShell command (irm … | iex)"),
      })
      .describe("The command that installs the module, per operating system"),
    expiresAt: z.string(),
  }),
  connectionStatus: z.discriminatedUnion("state", [
    z.object({ state: z.literal("pending"), expiresAt: z.string() }),
    z.object({ state: z.literal("connected"), keyId: z.string() }),
    z.object({ state: z.literal("expired") }),
  ]),
  redeem: z.object({
    url: z.string().describe("Garabato's public address"),
    key: z
      .string()
      .describe("The new token key; returned only in this response"),
    moduleSha256: z
      .string()
      .describe("SHA-256 of the module for the requested architecture"),
  }),
  installScript: z
    .file()
    .describe("POSIX shell script, or PowerShell script for os=windows"),
  module: z.file().describe("The PKCS#11 module, an ELF shared object"),
  listKeys: z.array(
    tokenKey.extend({
      moduleVersion: z.string(),
      platform: z.string(),
      outdated: z.boolean().describe("Below the minimum module version"),
    })
  ),
  switches: z.object(switches),
  settings,
  updateSettings: settings,
  revokeKey: z.object({ id: z.string(), success: z.boolean() }),
  certificates: z.array(
    z.object({
      id: z.uuid(),
      alias: z.string(),
      holder: z.string().describe("Holder common name"),
      certificate: z.string().describe("DER of the certificate, base64"),
    })
  ),
  unlock: z.object({
    expiresAt: z.string().describe("When the signing window closes"),
  }),
  lock: z.object({ locked: z.boolean() }),
  sign: z.object({ signature: z.string().describe("Signature, base64") }),
}
