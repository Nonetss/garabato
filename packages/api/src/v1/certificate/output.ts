import { z } from "zod"

export const certificateStatus = z
  .enum(["valid", "expiring", "expired"])
  .describe(
    "Computed at request time: expired after notAfter, expiring within 30 days of it, valid otherwise"
  )

// Public metadata only: no field here can carry the PKCS#12 file, the key or
// the password, so response validation also keeps secrets out of the API.
const certificateSummary = z.object({
  id: z.uuid(),
  alias: z.string(),
  commonName: z.string().describe("Holder common name"),
  givenName: z.string().nullable(),
  surname: z.string().nullable(),
  taxId: z
    .string()
    .nullable()
    .describe("NIF/NIE from the subject serialNumber, without its prefix"),
  issuerCommonName: z.string(),
  serialNumber: z.string().describe("Certificate serial number in hex"),
  fingerprintSha256: z.string().describe("SHA-256 of the certificate, hex"),
  keyAlgorithm: z.enum(["RSA", "EC"]),
  notBefore: z.string(),
  notAfter: z.string(),
  status: certificateStatus,
  passwordRemembered: z.boolean(),
  createdAt: z.string(),
})

export type CertificateSummary = z.infer<typeof certificateSummary>

export const certificateOutput = {
  list: z.array(certificateSummary),
  get: certificateSummary,
  import: certificateSummary,
  rename: certificateSummary,
  rememberPassword: certificateSummary,
  forgetPassword: certificateSummary,
  delete: z.object({
    id: z.uuid(),
    success: z.boolean(),
  }),
}
