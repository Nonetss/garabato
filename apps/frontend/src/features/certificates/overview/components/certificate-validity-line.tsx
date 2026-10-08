import { Text } from "@/components/shared/brand/typography"
import {
  StatusDot,
  StatusTag,
} from "@/components/shared/data-display/status-dot"
import { certificateStatusLabels } from "@/features/certificates/overview/definitions/certificate-labels"
import type { Certificate } from "@/features/certificates/overview/model/types"
import {
  certificateValidity,
  remainingLabel,
} from "@/features/certificates/overview/model/validity"
import { formatDate } from "@/lib/format"

/**
 * The validity window as a ruled line: issue date to expiry, solid up to
 * today and dashed after it, with the status dot standing on today. The
 * solid stretch draws itself in once, from the issue date.
 */
export function CertificateValidityLine({
  certificate,
  now,
  delayMs,
}: {
  certificate: Certificate
  now: Date
  /** When the solid stretch starts drawing. */
  delayMs: number
}) {
  const status = certificateStatusLabels[certificate.status]
  const validity = certificateValidity(
    certificate.notBefore,
    certificate.notAfter,
    now
  )
  const elapsed = `${validity.progress * 100}%`

  return (
    <div className="space-y-2">
      <div className="relative h-2.5" aria-hidden>
        <span className="absolute inset-y-0 left-0 w-px bg-foreground/30" />
        <span className="absolute inset-y-0 right-0 w-px bg-foreground/30" />
        <span
          className="absolute top-1/2 right-0 border-foreground/25 border-t border-dashed"
          style={{ left: elapsed }}
        />
        <div
          className="validity-draw absolute inset-y-0 left-0"
          style={{ width: elapsed, animationDelay: `${delayMs}ms` }}
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/55" />
          <StatusDot
            tone={status.tone}
            className="absolute top-1/2 right-0 size-2.5 translate-x-1/2 -translate-y-1/2 ring-4 ring-background"
          />
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <Text variant="data" tone="muted">
          {formatDate(certificate.notBefore)}
        </Text>
        <Text variant="data">{formatDate(certificate.notAfter)}</Text>
      </div>

      <div className="flex items-baseline justify-between gap-3 pt-1">
        <StatusTag>{status.label}</StatusTag>
        <Text variant="compact" tone="muted" className="tabular-nums">
          {remainingLabel(validity)}
        </Text>
      </div>
    </div>
  )
}
