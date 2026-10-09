import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { useEffect, useState } from "react"

GlobalWorkerOptions.workerSrc = workerUrl

type PdfState =
  | { status: "loading" }
  // `file` is the one `pdf` was parsed from: right after the input changes,
  // the previous file's pdf is still `ready` until the new one loads.
  | { status: "ready"; pdf: PDFDocumentProxy; file: File }
  | { status: "error" }

/** Parses a PDF file with pdf.js for rendering; destroys it on change. */
export function usePdfDocument(file: File | undefined): PdfState {
  const [state, setState] = useState<PdfState>({ status: "loading" })

  useEffect(() => {
    if (!file) return
    setState({ status: "loading" })
    let cancelled = false
    const load = async () => {
      const data = new Uint8Array(await file.arrayBuffer())
      const loading = getDocument({ data })
      try {
        const pdf = await loading.promise
        if (!cancelled) setState({ status: "ready", pdf, file })
      } catch {
        if (!cancelled) setState({ status: "error" })
      }
      return loading
    }
    const pending = load()
    return () => {
      cancelled = true
      pending.then((loading) => loading.destroy()).catch(() => undefined)
    }
  }, [file])

  return state
}
