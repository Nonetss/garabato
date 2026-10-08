import { Text } from "@/components/shared/brand/typography"
import type { EntityListDefinition } from "@/components/shared/resource/entity-list"
import {
  certificateLabels,
  certificateStatusLabels,
} from "@/features/certificates/overview/definitions/certificate-labels"
import type { Certificate } from "@/features/certificates/overview/model/types"
import { formatDate } from "@/lib/format"
import { iconRef } from "@/lib/icon-registry"

export interface CertificatesRowContext {
  onShowSignatures: (certificate: Certificate) => void
  onRename: (certificate: Certificate) => void
  onRememberPassword: (certificate: Certificate) => void
  onForgetPassword: (certificate: Certificate) => void
  onDelete: (certificate: Certificate) => void
}

function passwordLabel(certificate: Certificate) {
  if (certificate.passwordRemembered) {
    return certificateLabels.passwordRemembered
  }
  return certificateLabels.passwordAsked
}

/** The certificates overview's `EntityList` row: alias and holder, validity
 *  status, identity metadata and the rename/password/delete actions. */
export const certificateDefinition: EntityListDefinition<
  Certificate,
  CertificatesRowContext
> = {
  getKey: (certificate) => certificate.id,
  getAccessibleLabel: (certificate) => certificate.alias,
  getPrimary: (certificate) => certificate.alias,
  getSecondary: (certificate) => certificate.commonName,
  getStatus: (certificate) => certificateStatusLabels[certificate.status],
  isMuted: (certificate) => certificate.status === "expired",
  metadata: [
    {
      key: "taxId",
      label: certificateLabels.taxId,
      value: (certificate) => (
        <Text variant="data">{certificate.taxId ?? "—"}</Text>
      ),
    },
    {
      key: "issuer",
      label: certificateLabels.issuer,
      value: (certificate) => (
        <span className="truncate">{certificate.issuerCommonName}</span>
      ),
    },
    {
      key: "expires",
      label: certificateLabels.expires,
      value: (certificate) => (
        <span className="tabular-nums">{formatDate(certificate.notAfter)}</span>
      ),
    },
    {
      key: "password",
      label: certificateLabels.passwordColumn,
      value: (certificate) => (
        <Text variant="meta" tone="muted">
          {passwordLabel(certificate)}
        </Text>
      ),
    },
  ],
  actions: [
    {
      key: "signatures",
      label: certificateLabels.signatures,
      icon: iconRef("actions", "sign"),
      onSelect: (certificate, ctx) => ctx.onShowSignatures(certificate),
    },
    {
      key: "rename",
      label: certificateLabels.rename,
      icon: iconRef("actions", "edit"),
      onSelect: (certificate, ctx) => ctx.onRename(certificate),
    },
    {
      key: "remember",
      label: certificateLabels.remember,
      icon: iconRef("security", "rememberPassword"),
      hidden: (certificate) => certificate.passwordRemembered,
      onSelect: (certificate, ctx) => ctx.onRememberPassword(certificate),
    },
    {
      key: "forget",
      label: certificateLabels.forget,
      icon: iconRef("security", "forgetPassword"),
      hidden: (certificate) => !certificate.passwordRemembered,
      onSelect: (certificate, ctx) => ctx.onForgetPassword(certificate),
    },
    {
      key: "delete",
      label: certificateLabels.delete,
      icon: iconRef("actions", "delete"),
      destructive: true,
      onSelect: (certificate, ctx) => ctx.onDelete(certificate),
    },
  ],
}
