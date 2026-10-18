import { z } from "zod"

const rawSignatureHash = z.enum(["sha256", "sha384", "sha512"])

const mechanism = z
  .discriminatedUnion("name", [
    z
      .object({ name: z.literal("rsa-pkcs1") })
      .describe(
        "CKM_RSA_PKCS: PKCS#1 v1.5 over a DigestInfo the caller encoded (SHA-256, SHA-384 or SHA-512)"
      ),
    z
      .object({
        name: z.literal("rsa-pss"),
        hash: rawSignatureHash,
        saltLength: z.number().int().min(0).max(64),
      })
      .describe(
        "CKM_RSA_PKCS_PSS: RSA-PSS over a hash the caller computed, MGF1 with the same hash"
      ),
  ])
  .describe("The PKCS#11 mechanism the browser asked for")

const installCode = z
  .string()
  .min(8)
  .max(12)
  .describe("Install code, e.g. 7KQ4-XMPA (case and dash ignored)")

const moduleSystem = z
  .enum(["linux", "windows"])
  .default("linux")
  .describe("Operating system of the install script; linux when omitted")

export const certificateTokenInput = {
  startConnection: z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .describe("Name of the browser, e.g. Firefox portátil"),
  }),
  connectionStatus: z.object({ code: installCode }),
  redeem: z.object({
    code: installCode,
    arch: z.enum(["x86_64", "aarch64"]),
    os: moduleSystem,
  }),
  installScript: z.object({ code: z.string().max(32), os: moduleSystem }),
  module: z.object({
    arch: z.string().max(32),
    os: z.string().max(32).optional().describe("linux (default) or windows"),
  }),
  revokeKey: z.object({ id: z.string().min(1) }),
  unlock: z.object({
    code: z
      .string()
      .regex(/^\d{6}$/)
      .describe("Current code of the owner's authenticator app"),
  }),
  sign: z.object({
    certificateId: z.uuid(),
    mechanism,
    data: z.base64().max(256).describe("DigestInfo or hash to sign, base64"),
  }),
}
