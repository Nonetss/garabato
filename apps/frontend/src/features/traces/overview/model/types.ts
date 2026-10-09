import type { SignatureRecord } from "@/features/documents"

/** A signature record with the certificate data the log's detail shows. */
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

/** A certificate the user has signed with, offered by the log's filter. */
export type SignatureLogCertificate = {
  id: string
  alias: string
  holder: string
  deleted: boolean
}
