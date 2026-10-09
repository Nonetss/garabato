import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { documentHandler } from "#v1/document/handler"
import { documentInput } from "#v1/document/input"
import { heavyDocumentProcedure } from "#v1/document/operation-limit"
import { documentOutput } from "#v1/document/output"

export const documentRouter = {
  upload: heavyDocumentProcedure
    .meta(
      openapi({
        summary: "Upload a PDF document",
        description:
          "Uploads a PDF (multipart, at most 20 MiB, not password-protected) into the caller's document library as version 1, in `folderId` or the library root. It is stored encrypted in object storage. Shares a per-user limit with the other heavy document operations (2 at once, 30 per minute): over it answers TOO_MANY_REQUESTS.",
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
          "Returns the caller's documents that are not deleted, pinned first (most recently pinned first) and then newest first, with page count, current size, the count of live versions and of signatures on live versions, the last of those signing times, folder, tag ids and pin time.",
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
          "Returns one of the caller's documents with its live versions (oldest first) and all its signature records (newest first), each flagged `versionDeleted` when the version it produced has been deleted.",
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
          "Returns the PDF of the current version, or of the live version `versionNumber`, for rendering; a deleted version answers NOT_FOUND. Earlier versions are named with their number. Decrypted by the API; the object store never serves files directly. A safe read: it leaves no trace. Use `exportVersion` when the user saves the file.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .input(documentInput.download)
    .output(documentOutput.download)
    .handler(({ context, input }) =>
      documentHandler.download({ context, input })
    ),

  exportVersion: protectedProcedure
    .meta(
      openapi({
        summary: "Download a document version and trace it",
        description:
          "Returns the same PDF as `download` and records a `document.downloaded` trace for the version in the caller's trail. Meant for when the user saves the file.",
        tags: ["Documents"],
        method: "POST",
      })
    )
    .input(documentInput.download)
    .output(documentOutput.download)
    .handler(({ context, input }) =>
      documentHandler.exportVersion({ context, input })
    ),

  verifySignatures: heavyDocumentProcedure
    .meta(
      openapi({
        summary: "Check the signatures of a document version",
        description:
          "Checks every signature embedded in the current version, or in `versionId`, whoever made it: integrity, the CMS signature, coverage, the signer certificate's validity at the signing time (the timestamp's when present) and its chain to a trusted root (the runtime's Mozilla store plus bundled Spanish roots). Revocation is not checked. Changes nothing. Shares a per-user limit with the other heavy document operations (2 at once, 30 per minute): over it answers TOO_MANY_REQUESTS.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .input(documentInput.verifySignatures)
    .output(documentOutput.verifySignatures)
    .handler(({ context, input }) =>
      documentHandler.verifySignatures({ context, input })
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
          "Irreversibly destroys the document's data key, drops its tags and pin, and removes its stored objects best-effort. Its name and signature records are kept.",
        tags: ["Documents"],
        method: "DELETE",
      })
    )
    .input(documentInput.delete)
    .output(documentOutput.delete)
    .handler(({ context, input }) =>
      documentHandler.delete({ context, input })
    ),

  deleteMany: protectedProcedure
    .meta(
      openapi({
        summary: "Delete several documents",
        description:
          "Deletes 1 to 100 of the caller's documents like `delete`, all-or-nothing: when any id is not a live document of the caller, NOT_FOUND and none is deleted.",
        tags: ["Documents"],
        method: "DELETE",
      })
    )
    .input(documentInput.deleteMany)
    .output(documentOutput.deleteMany)
    .handler(({ context, input }) =>
      documentHandler.deleteMany({ context, input })
    ),

  move: protectedProcedure
    .meta(
      openapi({
        summary: "Move documents to a folder",
        description:
          "Moves 1 to 100 of the caller's documents into one of their folders, or to the library root (`folderId: null`). All-or-nothing: an unknown document or folder answers NOT_FOUND and nothing moves.",
        tags: ["Documents"],
        method: "PATCH",
      })
    )
    .input(documentInput.move)
    .output(documentOutput.move)
    .handler(({ context, input }) => documentHandler.move({ context, input })),

  updateTags: protectedProcedure
    .meta(
      openapi({
        summary: "Add and remove tags on documents",
        description:
          "Adds the `add` tags to and removes the `remove` tags from 1 to 100 of the caller's documents; other tags are untouched, and adding a carried tag or removing a missing one is a no-op. All-or-nothing: an unknown document or tag answers NOT_FOUND and nothing changes.",
        tags: ["Documents"],
        method: "PATCH",
      })
    )
    .input(documentInput.updateTags)
    .output(documentOutput.updateTags)
    .handler(({ context, input }) =>
      documentHandler.updateTags({ context, input })
    ),

  setPinned: protectedProcedure
    .meta(
      openapi({
        summary: "Pin or unpin documents",
        description:
          "Pins or unpins 1 to 100 of the caller's documents. Pinning an already pinned document keeps the moment it was first pinned. All-or-nothing: an unknown document answers NOT_FOUND and nothing changes.",
        tags: ["Documents"],
        method: "PATCH",
      })
    )
    .input(documentInput.setPinned)
    .output(documentOutput.setPinned)
    .handler(({ context, input }) =>
      documentHandler.setPinned({ context, input })
    ),

  sign: heavyDocumentProcedure
    .meta(
      openapi({
        summary: "Sign a document",
        description:
          "Signs the current version with one of the caller's valid certificates (PAdES B-B, incremental update) and stores the result as the next version, with a signature record. `baseVersionId` must still be the current version, otherwise CONFLICT. The password is the one sent or, when omitted, the remembered one. Shares a per-user limit with the other heavy document operations (2 at once, 30 per minute): over it answers TOO_MANY_REQUESTS.",
        tags: ["Documents"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(documentInput.sign)
    .output(documentOutput.sign)
    .handler(({ context, input }) => documentHandler.sign({ context, input })),

  editPages: heavyDocumentProcedure
    .meta(
      openapi({
        summary: "Edit the pages of a document",
        description:
          "Stores the next version of one of the caller's documents with its pages reordered, rotated (degrees added clockwise) and removed as `pages` lists them, and updates the document's page count. Earlier versions are kept. `baseVersionId` must still be the current version, otherwise CONFLICT. A document with signatures, recorded or embedded, answers CONFLICT, since rewriting it would invalidate them. A list that keeps no page, names a page twice or out of range, or changes nothing answers BAD_REQUEST. Shares a per-user limit with the other heavy document operations (2 at once, 30 per minute): over it answers TOO_MANY_REQUESTS.",
        tags: ["Documents"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(documentInput.editPages)
    .output(documentOutput.editPages)
    .handler(({ context, input }) =>
      documentHandler.editPages({ context, input })
    ),

  deleteLatestVersion: heavyDocumentProcedure
    .meta(
      openapi({
        summary: "Delete the latest version of a document",
        description:
          "Soft-deletes the current version of one of the caller's documents: the version row is kept, so the traces and the signature record that name it survive (flagged as a deleted version), its stored object is removed best-effort, the previous version becomes current again and the document's page count is restored from it. A signed version can be deleted; its signature record no longer counts as a signature of the document. Version numbers are never reused. `versionId` must still be the current version and the document must have another live version, otherwise CONFLICT. Records a `document.versionDeleted` trace. Returns the document as `get` does. Shares a per-user limit with the other heavy document operations (2 at once, 30 per minute): over it answers TOO_MANY_REQUESTS.",
        tags: ["Documents"],
        method: "DELETE",
      })
    )
    .input(documentInput.deleteLatestVersion)
    .output(documentOutput.deleteLatestVersion)
    .handler(({ context, input }) =>
      documentHandler.deleteLatestVersion({ context, input })
    ),

  merge: heavyDocumentProcedure
    .meta(
      openapi({
        summary: "Merge documents into a new one",
        description:
          "Creates a new document, in `folderId` or the library root, holding every page of the current version of 2 to 20 of the caller's documents in the given order; its version 1 has origin `merge`. The sources are left unchanged. An unknown or deleted document answers NOT_FOUND, a repeated one or a result over 20 MiB BAD_REQUEST, and a signed one CONFLICT. Shares a per-user limit with the other heavy document operations (2 at once, 30 per minute): over it answers TOO_MANY_REQUESTS.",
        tags: ["Documents"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(documentInput.merge)
    .output(documentOutput.merge)
    .handler(({ context, input }) => documentHandler.merge({ context, input })),

  signatures: protectedProcedure
    .meta(
      openapi({
        summary: "List signature records",
        description:
          "Returns the caller's signature records for one document or one certificate (pass exactly one), newest first, including records of deleted documents, certificates and versions (`versionDeleted`).",
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
          "Returns the caller's signature records across every document and certificate, newest first, paginated by cursor, including records of deleted documents, certificates and versions (`versionDeleted`). Optional filters: certificate, text the document name contains, and a signing-time interval (`signedFrom` inclusive, `signedBefore` exclusive). `total` counts every matching record.",
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
