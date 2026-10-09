import type { AppRouterClient } from "@nonete/api/router"
import { ORPCError } from "@orpc/client"
import type { StatusDotTone } from "@/components/shared/data-display/status-dot"

export type SignatureValidation = Awaited<
  ReturnType<AppRouterClient["v1"]["document"]["verifySignatures"]>
>
export type SignatureReport = SignatureValidation["signatures"][number]
export type SignatureVerdict = SignatureReport["verdict"]
export type SignatureChecks = NonNullable<SignatureReport["checks"]>

const verdictLabels: Record<SignatureVerdict, string> = {
  valid: "Válida",
  valid_untrusted: "Válida, emisor no reconocido",
  invalid: "No válida",
  indeterminate: "No comprobable",
}

// DESIGN.md: never green; destructive only for failures.
const verdictTones: Record<SignatureVerdict, StatusDotTone> = {
  valid: "foreground",
  valid_untrusted: "border",
  invalid: "destructive",
  indeterminate: "muted",
}

const coverageSummaries: Record<SignatureReport["coverage"], string> = {
  whole: "Cubre todo el documento",
  followed_by_signatures: "Cubre una versión anterior; después solo hay firmas",
  followed_by_changes: "Cubre una versión anterior; después hubo cambios",
}

/** The checks in the order the detail lists them, with their labels. */
export const checkRows: { key: keyof SignatureChecks; label: string }[] = [
  { key: "integrity", label: "Integridad" },
  { key: "signature", label: "Firma criptográfica" },
  { key: "coverage", label: "Alcance" },
  { key: "certificateValidity", label: "Vigencia del certificado" },
  { key: "trust", label: "Confianza en el emisor" },
]

export function verdictLabel(verdict: SignatureVerdict) {
  return verdictLabels[verdict]
}

export function verdictTone(verdict: SignatureVerdict) {
  return verdictTones[verdict]
}

export function checkTone(passed: boolean): StatusDotTone {
  if (passed) return "foreground"
  return "destructive"
}

export function coverageSummary(coverage: SignatureReport["coverage"]) {
  return coverageSummaries[coverage]
}

/** The signer's name, or the field name when the signature was unreadable. */
export function signerName(report: SignatureReport) {
  if (report.signer) return report.signer.holder
  if (report.fieldName) return report.fieldName
  return "Firma sin identificar"
}

/** What an empty history says: a PDF uploaded already signed has no
 *  signatures made in Garabato, but is not unsigned. */
export function emptyHistoryMessage(embeddedSignatures: number) {
  if (embeddedSignatures === 0) return "Este documento todavía no tiene firmas."
  return "Aún no se ha firmado en Garabato. El PDF ya traía firmas hechas fuera; su validez está más abajo."
}

const VALIDATION_FAILED_MESSAGE = "No se pudieron comprobar las firmas."

/**
 * The line shown when the check fails: the API's own message when the caller
 * is over the heavy-operation limit (it says to wait), a generic one
 * otherwise.
 */
export function validationErrorMessage(error: unknown): string {
  if (error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS") {
    return error.message
  }
  return VALIDATION_FAILED_MESSAGE
}
