import { Text } from "@/components/shared/brand/typography"
import {
  StatusDot,
  StatusTag,
} from "@/components/shared/data-display/status-dot"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useSignatureValidation } from "@/features/documents/detail/hooks/use-signature-validation"
import {
  checkRows,
  checkTone,
  coverageSummary,
  type SignatureReport,
  signerName,
  validationErrorMessage,
  verdictLabel,
  verdictTone,
} from "@/features/documents/detail/model/signature-validation"
import { formatDate, formatDateTime } from "@/lib/format"

function dateTime(iso: string | null) {
  return formatDateTime(iso, { includeYear: true, includeSeconds: true })
}

function ReportSummary({ report }: { report: SignatureReport }) {
  return (
    // `flex-1 min-w-0` keeps the summary inside the trigger, so a long holder
    // name wraps instead of pushing the chevron out of the card.
    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <StatusTag dotTone={verdictTone(report.verdict)} className="self-start">
        {verdictLabel(report.verdict)}
      </StatusTag>
      <Text variant="title" className="wrap-break-word">
        {signerName(report)}
      </Text>
      <Text variant="compact" tone="muted" className="tabular-nums">
        {dateTime(report.claimedTime)}
      </Text>
      {report.timestamp ? (
        <Text variant="compact" tone="muted" className="tabular-nums">
          Sello de tiempo: {dateTime(report.timestamp.time)}
        </Text>
      ) : null}
      <Text variant="compact" tone="muted">
        {coverageSummary(report.coverage)}
      </Text>
    </span>
  )
}

function ReportDetail({ report }: { report: SignatureReport }) {
  return (
    <div className="space-y-3 px-4 pb-4">
      {report.modifiedAfterSigning ? (
        <Text as="p" variant="compact" tone="destructive">
          El documento se modificó después de esta firma.
        </Text>
      ) : null}
      {report.problem ? (
        <Text as="p" variant="compact" tone="muted">
          {report.problem}
        </Text>
      ) : null}
      {report.checks ? (
        <ul className="space-y-2">
          {checkRows.map(({ key, label }) => {
            const check = report.checks?.[key]
            if (!check) return null
            return (
              <li key={key} className="flex items-start gap-2">
                <StatusDot
                  tone={checkTone(check.passed)}
                  className="mt-1.5 shrink-0"
                />
                <span className="min-w-0 wrap-break-word">
                  <Text as="p" variant="title">
                    {label}
                  </Text>
                  <Text as="p" variant="compact" tone="muted">
                    {check.reason}
                  </Text>
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
      {report.signer ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <Text as="dt" variant="compact" tone="muted">
            Emisor
          </Text>
          <Text as="dd" variant="compact" className="min-w-0 wrap-break-word">
            {report.signer.issuer}
          </Text>
          {report.signer.taxId ? (
            <>
              <Text as="dt" variant="compact" tone="muted">
                NIF
              </Text>
              <Text as="dd" variant="data">
                {report.signer.taxId}
              </Text>
            </>
          ) : null}
          <Text as="dt" variant="compact" tone="muted">
            Vigencia
          </Text>
          <Text as="dd" variant="compact" className="tabular-nums">
            {formatDate(report.signer.notBefore)} –{" "}
            {formatDate(report.signer.notAfter)}
          </Text>
          {report.level ? (
            <>
              <Text as="dt" variant="compact" tone="muted">
                Nivel
              </Text>
              <Text as="dd" variant="compact">
                PAdES {report.level}
              </Text>
            </>
          ) : null}
          {report.timestamp ? (
            <>
              <Text as="dt" variant="compact" tone="muted">
                Sello
              </Text>
              <Text
                as="dd"
                variant="compact"
                className="min-w-0 wrap-break-word"
              >
                {report.timestamp.authority}
              </Text>
            </>
          ) : null}
        </dl>
      ) : null}
    </div>
  )
}

function ValidationBody({
  documentId,
  versionId,
}: {
  documentId: string
  versionId: string
}) {
  const { data, error, isPending, isError, refetch } = useSignatureValidation(
    documentId,
    versionId
  )
  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3">
        <Text as="p" variant="compact" tone="destructive">
          {validationErrorMessage(error)}
        </Text>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (isPending) {
    return (
      <Text
        as="p"
        variant="compact"
        tone="muted"
        className="flex items-center gap-2"
      >
        <Spinner decorative />
        Comprobando las firmas…
      </Text>
    )
  }
  if (data.parseError) {
    return (
      <Text as="p" variant="compact" tone="muted">
        No se pudo leer el PDF para comprobar sus firmas.
      </Text>
    )
  }
  if (data.signatures.length === 0) {
    return (
      <Text as="p" variant="meta" tone="muted">
        Este documento no tiene firmas.
      </Text>
    )
  }
  return (
    <Accordion multiple className="space-y-2">
      {data.signatures.map((report, index) => (
        <AccordionItem
          key={`${report.fieldName}-${index}`}
          value={`${index}`}
          className="overflow-hidden rounded-xl border bg-card/40 last:border-b"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <ReportSummary report={report} />
          </AccordionTrigger>
          <AccordionContent className="p-0">
            <ReportDetail report={report} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/**
 * Checks every signature embedded in the current version, whoever made it,
 * and lists each with its verdict; expanding one shows every check.
 */
export function SignatureValidation({
  documentId,
  versionId,
}: {
  documentId: string
  versionId: string
}) {
  return (
    <div className="space-y-3">
      <ValidationBody documentId={documentId} versionId={versionId} />
      <Text as="p" variant="meta" tone="muted">
        La revocación de los certificados no se comprueba.
      </Text>
    </div>
  )
}
