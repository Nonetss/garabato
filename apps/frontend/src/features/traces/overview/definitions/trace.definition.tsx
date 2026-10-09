import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import {
  deletedAware,
  placementLabel,
} from "@/features/signatures/overview/model/filters"
import type { SignatureLogRecord } from "@/features/signatures/overview/model/types"
import { formatDateTime } from "@/lib/format"

export interface SignaturesRowContext {
  onOpen: (record: SignatureLogRecord) => void
}

function certificateLine(record: SignatureLogRecord) {
  const alias = deletedAware(record.certificateAlias, record.certificateDeleted)
  if (record.certificateHolder === record.certificateAlias) return alias
  return `${alias} · ${record.certificateHolder}`
}

/** The signature log's `EntityList` row: the document, the certificate it
 *  was signed with, when, which version it produced and where the stamp is.
 *  The row opens the record's detail. */
export const signatureDefinition: EntityListDefinition<
  SignatureLogRecord,
  SignaturesRowContext
> = {
  getKey: (record) => record.id,
  getAccessibleLabel: (record) =>
    `Firma de ${record.documentName}, ${formatDateTime(record.signedAt, {
      includeYear: true,
    })}`,
  getPrimary: (record) =>
    deletedAware(record.documentName, record.documentDeleted),
  getSecondary: certificateLine,
  onOpen: (record, context) => context.onOpen(record),
  metadata: [
    {
      key: "signedAt",
      label: "Fecha",
      value: (record) => (
        <span className="tabular-nums">
          {formatDateTime(record.signedAt, { includeYear: true })}
        </span>
      ),
    },
    {
      key: "version",
      label: "Versión",
      value: (record) => (
        <span className="tabular-nums">v{record.versionNumber}</span>
      ),
    },
    {
      key: "placement",
      label: "Firma",
      value: (record) => placementLabel(record),
    },
  ],
}
