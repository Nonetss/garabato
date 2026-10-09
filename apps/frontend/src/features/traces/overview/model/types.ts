import type { SignatureRecord } from "@/features/documents"

/** A signature record with the certificate data the trail's detail shows. */
export type SignatureLogRecord = SignatureRecord & {
  certificateDeleted: boolean
  certificateTaxId: string | null
  certificateIssuer: string
  certificateSerialNumber: string
  /** SHA-256 of the certificate DER, lowercase hex. */
  certificateFingerprint: string
  certificateNotBefore: string
  certificateNotAfter: string
}

/** A certificate of the user, offered by the trail's filter. */
export type TraceCertificate = {
  id: string
  alias: string
  holder: string
  deleted: boolean
}

/** Every entry type of the trail, in the order the type filter lists them. */
export const TRAIL_TYPES = [
  "document.signed",
  "document.uploaded",
  "document.merged",
  "document.pagesEdited",
  "document.downloaded",
  "document.renamed",
  "document.moved",
  "document.deleted",
  "certificate.imported",
  "certificate.renamed",
  "certificate.passwordRemembered",
  "certificate.passwordForgotten",
  "certificate.deleted",
] as const

export type TrailType = (typeof TRAIL_TYPES)[number]

/** A folder as the trace keeps it; null is the library root. */
export type TraceFolderRef = { id: string; name: string } | null

type TrailCommon = {
  id: string
  occurredAt: string
  ipAddress: string | null
  /** The document it is about; null for certificate entries. */
  document: { id: string; name: string; deleted: boolean } | null
  /** The certificate it is about; null for most document entries. */
  certificate: {
    id: string
    alias: string
    holder: string
    deleted: boolean
  } | null
  /** The version the action produced or delivered. */
  version: { id: string; number: number } | null
}

export type TrailEntry =
  | (TrailCommon & {
      type:
        | "certificate.imported"
        | "certificate.passwordRemembered"
        | "certificate.passwordForgotten"
        | "certificate.deleted"
        | "document.uploaded"
        | "document.pagesEdited"
        | "document.downloaded"
        | "document.deleted"
      details: null
    })
  | (TrailCommon & {
      type: "certificate.renamed" | "document.renamed"
      details: { from: string; to: string }
    })
  | (TrailCommon & {
      type: "document.moved"
      details: { from: TraceFolderRef; to: TraceFolderRef }
    })
  | (TrailCommon & {
      type: "document.merged"
      details: { sources: { id: string; name: string }[] }
    })
  | (TrailCommon & {
      type: "document.signed"
      details: null
      signature: SignatureLogRecord
    })
