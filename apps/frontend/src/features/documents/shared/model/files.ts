/** Mirrors the API cap on uploaded PDFs. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024

export type PdfFileProblem = "not-pdf" | "too-large"

/** Why a picked or dropped file can't be uploaded, or `null` when it can. */
export function pdfFileProblem(file: File): PdfFileProblem | null {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  if (!isPdf) return "not-pdf"
  if (file.size > MAX_PDF_BYTES) return "too-large"
  return null
}

/** Hands a file to the browser as a download. */
export function saveFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  link.click()
  // Let the click start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
