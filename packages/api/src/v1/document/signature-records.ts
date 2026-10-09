import { db } from "@nonete/db"
import {
  certificates,
  type DocumentSignature,
  documentSignatures,
  documents,
  documentVersions,
} from "@nonete/db/schema"
import { eq } from "drizzle-orm"

import { toIso, toIsoOrNull } from "#shared/dates"
import type { SignatureLogRecord, SignatureRecord } from "#v1/document/output"

// Signature records as the document, certificate and trail views show them:
// the signature row joined to its document, version and certificate.

export type SignatureJoin = {
  signature: DocumentSignature
  documentName: string
  documentDeletedAt: Date | null
  versionNumber: number
  versionDeletedAt: Date | null
  certificateAlias: string
  certificateHolder: string
}

export function toRecord(row: SignatureJoin): SignatureRecord {
  const { signature } = row
  return {
    id: signature.id,
    documentId: signature.documentId,
    documentName: row.documentName,
    documentDeleted: row.documentDeletedAt !== null,
    versionId: signature.versionId,
    versionNumber: row.versionNumber,
    versionDeleted: row.versionDeletedAt !== null,
    certificateId: signature.certificateId,
    certificateAlias: row.certificateAlias,
    certificateHolder: row.certificateHolder,
    signedAt: toIso(signature.signedAt),
    visible: signature.visible,
    pages: signature.pages,
    rect: signature.rect,
    reason: signature.reason,
    location: signature.location,
    sha256Before: signature.sha256Before,
    sha256After: signature.sha256After,
    ipAddress: signature.ipAddress,
    timestampedAt: toIsoOrNull(signature.timestampedAt),
    timestampAuthority: signature.timestampAuthority,
  }
}

export type SignatureLogJoin = SignatureJoin & {
  certificateDeletedAt: Date | null
  certificateTaxId: string | null
  certificateIssuer: string
  certificateSerialNumber: string
  certificateFingerprint: string
  certificateNotBefore: Date
  certificateNotAfter: Date
}

export function toLogRecord(row: SignatureLogJoin): SignatureLogRecord {
  return {
    ...toRecord(row),
    certificateDeleted: row.certificateDeletedAt !== null,
    certificateTaxId: row.certificateTaxId,
    certificateIssuer: row.certificateIssuer,
    certificateSerialNumber: row.certificateSerialNumber,
    certificateFingerprint: row.certificateFingerprint,
    certificateNotBefore: toIso(row.certificateNotBefore),
    certificateNotAfter: toIso(row.certificateNotAfter),
  }
}

/** Signature rows with everything a signature log record shows. */
export function signatureJoin() {
  return db
    .select({
      signature: documentSignatures,
      documentName: documents.name,
      documentDeletedAt: documents.deletedAt,
      versionNumber: documentVersions.number,
      versionDeletedAt: documentVersions.deletedAt,
      certificateAlias: certificates.alias,
      certificateHolder: certificates.commonName,
      certificateDeletedAt: certificates.deletedAt,
      certificateTaxId: certificates.taxId,
      certificateIssuer: certificates.issuerCommonName,
      certificateSerialNumber: certificates.serialNumber,
      certificateFingerprint: certificates.fingerprintSha256,
      certificateNotBefore: certificates.notBefore,
      certificateNotAfter: certificates.notAfter,
    })
    .from(documentSignatures)
    .innerJoin(documents, eq(documents.id, documentSignatures.documentId))
    .innerJoin(
      documentVersions,
      eq(documentVersions.id, documentSignatures.versionId)
    )
    .innerJoin(
      certificates,
      eq(certificates.id, documentSignatures.certificateId)
    )
}
