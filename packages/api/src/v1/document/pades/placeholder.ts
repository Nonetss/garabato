import {
  EncryptedPDFError,
  type PDFDict,
  PDFDocument,
  PDFHexString,
  PDFInvalidObject,
  PDFName,
  PDFNumber,
  type PDFObject,
  type PDFRef,
  PDFString,
  StandardFonts,
} from "@cantoo/pdf-lib"
import {
  DEFAULT_BYTE_RANGE_PLACEHOLDER,
  SUBFILTER_ETSI_CADES_DETACHED,
} from "@signpdf/utils"
import {
  appearanceStream,
  placeWidgets,
  type VisibleAppearance,
} from "#v1/document/pades/appearance"

/** Room for the CMS: certificate chain and signature with margin. */
const SIGNATURE_BYTES = 16 * 1024
const PRINT_FLAG = 4
const SIG_FLAGS_SIGNATURES_EXIST = 1
const SIG_FLAGS_APPEND_ONLY = 2

export type PlaceholderOptions = {
  signerName: string
  reason?: string
  location?: string
  signingTime: Date
  /** Omit for an invisible signature. */
  appearance?: VisibleAppearance
  lines: string[]
}

export class EncryptedPdfError extends Error {}

function textString(value: string) {
  // UTF-16 hex strings keep accents and ñ intact in viewers.
  return PDFHexString.fromText(value)
}

function signatureDictionary(doc: PDFDocument, options: PlaceholderOptions) {
  const byteRange = doc.context.obj([
    0,
    PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER),
    PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER),
    PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER),
  ])
  const dict = doc.context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: SUBFILTER_ETSI_CADES_DETACHED,
    ByteRange: byteRange,
    Contents: PDFHexString.of("0".repeat(SIGNATURE_BYTES * 2)),
    M: PDFString.fromDate(options.signingTime),
    Prop_Build: { App: { Name: PDFName.of("Autofirmas") } },
  })
  dict.set(PDFName.of("Name"), textString(options.signerName))
  if (options.reason) dict.set(PDFName.of("Reason"), textString(options.reason))
  if (options.location) {
    dict.set(PDFName.of("Location"), textString(options.location))
  }
  // Serialized by hand so /Contents never lands compressed inside an object
  // stream, where the byte-range signer could not find it.
  const raw = new Uint8Array(dict.sizeInBytes())
  dict.copyBytesInto(raw, 0)
  return doc.context.register(PDFInvalidObject.of(raw))
}

// /Annots may be an indirect array; the update must rewrite it too.
function annotArrays(pages: { node: PDFDict }[]) {
  const arrays: PDFObject[] = []
  for (const page of pages) {
    const annots = page.node.get(PDFName.of("Annots"))
    if (annots) arrays.push(annots)
  }
  return arrays
}

async function loadForUpdate(pdf: Uint8Array) {
  try {
    return await PDFDocument.load(pdf, { forIncrementalUpdate: true })
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new EncryptedPdfError("Encrypted PDFs cannot be signed")
    }
    throw error
  }
}

/**
 * Adds a signature field with an empty byte-range placeholder as an
 * incremental update: the original bytes, and any signature in them, stay
 * untouched. Returns the full PDF and the 0-based pages carrying a stamp.
 */
export async function addPlaceholder(
  pdf: Uint8Array,
  options: PlaceholderOptions
): Promise<{ bytes: Buffer; pages: number[] }> {
  const doc = await loadForUpdate(pdf)
  const snapshot = doc.takeSnapshot()
  const touched: PDFObject[] = []
  const pages = doc.getPages()

  const signatureRef = signatureDictionary(doc, options)
  const acroForm = doc.catalog.getOrCreateAcroForm()
  const fieldRef = doc.context.nextRef()
  const widgets: PDFRef[] = []
  const stamped: number[] = []

  if (options.appearance) {
    const font = await doc.embedFont(StandardFonts.Helvetica)
    // One field, one widget per stamped page.
    for (const placement of placeWidgets(pages, options.appearance)) {
      const page = pages[placement.pageIndex]
      if (!page) continue
      const widget = doc.context.register(
        doc.context.obj({
          Type: "Annot",
          Subtype: "Widget",
          Parent: fieldRef,
          Rect: placement.rect,
          F: PRINT_FLAG,
          P: page.ref,
          MK: { R: placement.rotation },
          AP: {
            N: appearanceStream(doc, font, placement, options.lines),
          },
        })
      )
      widgets.push(widget)
      stamped.push(placement.pageIndex)
      page.node.addAnnot(widget)
      touched.push(page.node)
    }
    await doc.flush()
  } else {
    const page = doc.getPage(0)
    const widget = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Widget",
        Parent: fieldRef,
        Rect: [0, 0, 0, 0],
        F: PRINT_FLAG,
        P: page.ref,
      })
    )
    widgets.push(widget)
    page.node.addAnnot(widget)
    touched.push(page.node)
  }

  const existingFields = acroForm.getAllFields().length
  doc.context.assign(
    fieldRef,
    doc.context.obj({
      FT: "Sig",
      T: PDFString.of(`Firma${existingFields + 1}`),
      V: signatureRef,
      Kids: widgets,
    })
  )
  acroForm.addField(fieldRef)
  const sigFlags = acroForm.dict.lookupMaybe(PDFName.of("SigFlags"), PDFNumber)
  acroForm.dict.set(
    PDFName.of("SigFlags"),
    PDFNumber.of(
      (sigFlags?.asNumber() ?? 0) |
        SIG_FLAGS_SIGNATURES_EXIST |
        SIG_FLAGS_APPEND_ONLY
    )
  )

  touched.push(doc.catalog, acroForm.dict, ...annotArrays(pages))
  snapshot.markObjsForSave(touched)

  const update = await doc.saveIncremental(snapshot, {
    useObjectStreams: false,
  })
  return { bytes: Buffer.concat([pdf, update]), pages: stamped }
}
