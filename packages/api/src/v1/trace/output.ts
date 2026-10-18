import { z } from "zod"

import {
  signatureLogCertificate,
  signatureLogRecord,
} from "#v1/document/output"

const documentRef = z
  .object({
    id: z.uuid(),
    name: z.string().describe("The document's current name"),
    deleted: z.boolean(),
  })
  .nullable()
  .describe("The document the entry is about; null for certificate entries")

const certificateRef = z
  .object({
    id: z.uuid(),
    alias: z.string(),
    holder: z.string(),
    deleted: z.boolean(),
  })
  .nullable()
  .describe(
    "The certificate the entry is about; null for most document entries"
  )

const versionRef = z
  .object({
    id: z.uuid(),
    number: z.number().int(),
    deleted: z.boolean().describe("The version has since been deleted"),
  })
  .nullable()
  .describe("The version the action produced, delivered or deleted")

const folderRef = z
  .object({ id: z.uuid(), name: z.string() })
  .nullable()
  .describe("A folder as named when the trace was written; null is the root")

const common = {
  id: z.uuid(),
  occurredAt: z.string(),
  ipAddress: z.string().nullable(),
  document: documentRef,
  certificate: certificateRef,
  version: versionRef,
}

const plainEntry = z.object({
  ...common,
  type: z.enum([
    "certificate.imported",
    "certificate.passwordRemembered",
    "certificate.passwordForgotten",
    "certificate.deleted",
    "document.uploaded",
    "document.pagesEdited",
    "document.downloaded",
    "document.versionDeleted",
    "document.deleted",
    "account.signedOut",
    "account.passwordChanged",
    "account.twoFactorEnabled",
    "account.twoFactorDisabled",
    "account.twoFactorFailed",
  ]),
  details: z.null(),
})

const renameEntry = z.object({
  ...common,
  type: z.enum([
    "certificate.renamed",
    "document.renamed",
    "account.nameChanged",
  ]),
  details: z.object({
    from: z.string().describe("Previous name or alias"),
    to: z.string().describe("New name or alias"),
  }),
})

const moveEntry = z.object({
  ...common,
  type: z.literal("document.moved"),
  details: z.object({ from: folderRef, to: folderRef }),
})

const mergeEntry = z.object({
  ...common,
  type: z.literal("document.merged"),
  details: z.object({
    sources: z
      .array(z.object({ id: z.uuid(), name: z.string() }))
      .describe("The merged documents in merge order, as then named"),
  }),
})

const signInEntry = z.object({
  ...common,
  type: z.literal("certificate.usedToSignIn"),
  details: z.object({
    key: z
      .object({ id: z.string(), name: z.string() })
      .describe(
        "The token key (browser) that used the certificate, as then named"
      ),
  }),
})

const keyRef = z
  .object({ id: z.string(), name: z.string() })
  .describe("The connected browser (token key), as then named")

const browserEntry = z.object({
  ...common,
  type: z.enum(["browser.disconnected", "browser.unlocked", "browser.locked"]),
  details: z.object({ key: keyRef }),
})

const browserConnectedEntry = z.object({
  ...common,
  type: z.literal("browser.connected"),
  details: z.object({
    key: keyRef,
    platform: z.string().describe("Module platform, e.g. linux-x86_64"),
  }),
})

const browserUnlockFailedEntry = z.object({
  ...common,
  type: z.literal("browser.unlockFailed"),
  details: z.object({
    key: keyRef,
    reason: z.enum(["wrong-code", "locked-out"]),
  }),
})

const browserInstallRefusedEntry = z.object({
  ...common,
  type: z.literal("browser.installRefused"),
  details: z.object({
    name: z
      .string()
      .describe("The browser name the connection was started for"),
    reason: z.enum(["used", "expired"]),
  }),
})

const signedInEntry = z.object({
  ...common,
  type: z.literal("account.signedIn"),
  details: z.object({
    method: z.enum(["password", "sso"]),
    userAgent: z.string().nullable(),
  }),
})

const signInFailedEntry = z.object({
  ...common,
  type: z.literal("account.signInFailed"),
  details: z.object({ reason: z.enum(["wrong-password", "banned"]) }),
})

const signedEntry = z.object({
  ...common,
  type: z.literal("document.signed"),
  details: z.null(),
  signature: signatureLogRecord,
})

const trailEntry = z.discriminatedUnion("type", [
  plainEntry,
  renameEntry,
  moveEntry,
  mergeEntry,
  signInEntry,
  browserEntry,
  browserConnectedEntry,
  browserUnlockFailedEntry,
  browserInstallRefusedEntry,
  signedInEntry,
  signInFailedEntry,
  signedEntry,
])

export type TrailEntry = z.infer<typeof trailEntry>
export type TrailCommon = z.infer<z.ZodObject<typeof common>>

export const traceOutput = {
  list: z.object({
    entries: z.array(trailEntry).describe("Newest first"),
    total: z
      .number()
      .int()
      .nonnegative()
      .describe("Entries matching the filters, across every page"),
    nextCursor: z.string().nullable(),
  }),
  certificates: z.array(signatureLogCertificate),
}
