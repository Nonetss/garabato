import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { documentHandler } from "#v1/document/handler"
import { documentInput } from "#v1/document/input"
import { documentOutput } from "#v1/document/output"

export const documentRouter = {
  upload: protectedProcedure
    .meta(
      openapi({
        summary: "Upload a PDF document",
        description:
          "Uploads a PDF (multipart, at most 20 MiB, not password-protected) into the caller's document library as version 1. It is stored encrypted in object storage.",
        tags: ["Documents"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(documentInput.upload)
    .output(documentOutput.upload)
    .handler(({ context, input }) =>
      documentHandler.upload({ context, input })
    ),

  list: protectedProcedure
    .meta(
      openapi({
        summary: "List my documents",
        description:
          "Returns the caller's documents that are not deleted, newest first, with page count, current size, version and signature counts and the last signing time.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .output(documentOutput.list)
    .handler(({ context }) => documentHandler.list({ context })),

  get: protectedProcedure
    .meta(
      openapi({
        summary: "Get a document",
        description:
          "Returns one of the caller's documents with its versions (oldest first) and its signature records (newest first).",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .input(documentInput.get)
    .output(documentOutput.get)
    .handler(({ context, input }) => documentHandler.get({ context, input })),

  download: protectedProcedure
    .meta(
      openapi({
        summary: "Download a document version",
        description:
          "Returns the PDF of the current version, or of `versionNumber`. Earlier versions are named with their number. Decrypted by the API; the object store never serves files directly.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .input(documentInput.download)
    .output(documentOutput.download)
    .handler(({ context, input }) =>
      documentHandler.download({ context, input })
    ),

  rename: protectedProcedure
    .meta(
      openapi({
        summary: "Rename a document",
        description:
          "Changes the name of one of the caller's documents. Control characters are stripped and `.pdf` is appended when missing. Signature records show the new name.",
        tags: ["Documents"],
        method: "PATCH",
      })
    )
    .input(documentInput.rename)
    .output(documentOutput.rename)
    .handler(({ context, input }) =>
      documentHandler.rename({ context, input })
    ),

  delete: protectedProcedure
    .meta(
      openapi({
        summary: "Delete a document",
        description:
          "Irreversibly destroys the document's data key and removes its stored objects best-effort. Its name and signature records are kept.",
        tags: ["Documents"],
        method: "DELETE",
      })
    )
    .input(documentInput.delete)
    .output(documentOutput.delete)
    .handler(({ context, input }) =>
      documentHandler.delete({ context, input })
    ),

  sign: protectedProcedure
    .meta(
      openapi({
        summary: "Sign a document",
        description:
          "Signs the current version with one of the caller's valid certificates (PAdES B-B, incremental update) and stores the result as the next version, with a signature record. `baseVersionId` must still be the current version, otherwise CONFLICT. The password is the one sent or, when omitted, the remembered one.",
        tags: ["Documents"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(documentInput.sign)
    .output(documentOutput.sign)
    .handler(({ context, input }) => documentHandler.sign({ context, input })),

  signatures: protectedProcedure
    .meta(
      openapi({
        summary: "List signature records",
        description:
          "Returns the caller's signature records for one document or one certificate (pass exactly one), newest first, including records of deleted documents and certificates.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .input(documentInput.signatures)
    .output(documentOutput.signatures)
    .handler(({ context, input }) =>
      documentHandler.signatures({ context, input })
    ),

  signatureLog: protectedProcedure
    .meta(
      openapi({
        summary: "List my signature log",
        description:
          "Returns the caller's signature records across every document and certificate, newest first, paginated by cursor, including records of deleted documents and certificates. Optional filters: certificate, text the document name contains, and a signing-time interval (`signedFrom` inclusive, `signedBefore` exclusive). `total` counts every matching record.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .input(documentInput.signatureLog)
    .output(documentOutput.signatureLog)
    .handler(({ context, input }) =>
      documentHandler.signatureLog({ context, input })
    ),

  signatureLogCertificates: protectedProcedure
    .meta(
      openapi({
        summary: "List the certificates of my signature log",
        description:
          "Returns every certificate the caller has signed with at least once, deleted ones included, ordered by alias. Meant for the signature log's certificate filter.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .output(documentOutput.signatureLogCertificates)
    .handler(({ context }) =>
      documentHandler.signatureLogCertificates({ context })
    ),
}
