import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { certificateHandler } from "#v1/certificate/handler"
import { certificateInput } from "#v1/certificate/input"
import { certificateOutput } from "#v1/certificate/output"

export const certificateRouter = {
  list: protectedProcedure
    .meta(
      openapi({
        summary: "List my certificates",
        description:
          "Returns the caller's signing certificates that are not deleted, newest first, with their public metadata and validity status. Never returns key material.",
        tags: ["Certificates"],
        method: "GET",
      })
    )
    .output(certificateOutput.list)
    .handler(({ context }) => certificateHandler.list({ context })),

  get: protectedProcedure
    .meta(
      openapi({
        summary: "Get a certificate",
        description:
          "Returns one of the caller's certificates. Another user's or a deleted certificate answers NOT_FOUND.",
        tags: ["Certificates"],
        method: "GET",
      })
    )
    .input(certificateInput.get)
    .output(certificateOutput.get)
    .handler(({ context, input }) =>
      certificateHandler.get({ context, input })
    ),

  import: protectedProcedure
    .meta(
      openapi({
        summary: "Import a PKCS#12 certificate",
        description:
          "Uploads a .p12/.pfx file (multipart, at most 100 KiB) with its password. The file must hold exactly one private key and a matching certificate allowed to sign, not expired and not already imported by the caller. The file is stored encrypted; the password only when rememberPassword is true.",
        tags: ["Certificates"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(certificateInput.import)
    .output(certificateOutput.import)
    .handler(({ context, input }) =>
      certificateHandler.import({ context, input })
    ),

  rename: protectedProcedure
    .meta(
      openapi({
        summary: "Rename a certificate",
        description: "Changes the alias of one of the caller's certificates.",
        tags: ["Certificates"],
        method: "PATCH",
      })
    )
    .input(certificateInput.rename)
    .output(certificateOutput.rename)
    .handler(({ context, input }) =>
      certificateHandler.rename({ context, input })
    ),

  rememberPassword: protectedProcedure
    .meta(
      openapi({
        summary: "Remember a certificate's password",
        description:
          "Verifies the password against the stored file and stores it encrypted, replacing any remembered one. Idempotent. A wrong password answers BAD_REQUEST and changes nothing.",
        tags: ["Certificates"],
        method: "PUT",
      })
    )
    .input(certificateInput.rememberPassword)
    .output(certificateOutput.rememberPassword)
    .handler(({ context, input }) =>
      certificateHandler.rememberPassword({ context, input })
    ),

  forgetPassword: protectedProcedure
    .meta(
      openapi({
        summary: "Forget a certificate's password",
        description:
          "Erases the remembered password, so signing asks for it again.",
        tags: ["Certificates"],
        method: "DELETE",
      })
    )
    .input(certificateInput.forgetPassword)
    .output(certificateOutput.forgetPassword)
    .handler(({ context, input }) =>
      certificateHandler.forgetPassword({ context, input })
    ),

  delete: protectedProcedure
    .meta(
      openapi({
        summary: "Delete a certificate",
        description:
          "Irreversibly erases the encrypted file and remembered password (crypto-shredding) and hides the certificate; its public metadata is kept for signature records. The same certificate can be imported again afterwards.",
        tags: ["Certificates"],
        method: "DELETE",
      })
    )
    .input(certificateInput.delete)
    .output(certificateOutput.delete)
    .handler(({ context, input }) =>
      certificateHandler.delete({ context, input })
    ),
}
