import { z } from "zod"

/** Real PKCS#12 files are 5–20 KiB; anything far bigger is not one. */
export const MAX_P12_BYTES = 100 * 1024

const id = z.uuid().describe("Certificate id")
const alias = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("Name the user gives the certificate")
const password = z
  .string()
  .max(256)
  .describe("Password of the PKCS#12 file. Never stored unless remembered")

export const certificateInput = {
  get: z.object({ id }),

  import: z.object({
    // The MIME type is not checked: browsers send several or none for
    // .p12/.pfx, so parsing the file is the real check.
    file: z
      .file()
      .max(MAX_P12_BYTES)
      .describe("PKCS#12 file (.p12 or .pfx), at most 100 KiB"),
    password,
    alias: alias
      .optional()
      .describe("Defaults to the certificate holder's common name"),
    rememberPassword: z
      .boolean()
      .default(false)
      .describe("Store the password encrypted so signing does not ask for it"),
  }),

  rename: z.object({ id, alias }),

  rememberPassword: z.object({ id, password }),

  forgetPassword: z.object({ id }),

  delete: z.object({ id }),
}
