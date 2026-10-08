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

/** 1-based page list for display: "1", "1–3", "1, 3". */
export function formatPages(pages: number[]): string {
  if (pages.length === 0) return "—"
  const sorted = [...pages].sort((a, b) => a - b).map((page) => page + 1)
  const first = sorted[0]
  const last = sorted.at(-1)
  const contiguous = sorted.every(
    (page, index) => page === (first ?? 0) + index
  )
  if (contiguous && sorted.length > 2) return `${first}–${last}`
  return sorted.join(", ")
}
