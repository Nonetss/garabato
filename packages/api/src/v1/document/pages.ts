import {
  degrees,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  type PDFObject,
  type PDFPageLeaf,
  PDFRef,
  PDFStream,
} from "@cantoo/pdf-lib"

import { extractSignatures } from "#v1/document/validation/extract"

/** Clockwise quarter turns added to a page's own rotation. */
export type PageRotation = 0 | 90 | 180 | 270

/** One page of the result: a 0-based page of the source and its turn. */
export type PageEdit = { page: number; rotation: PageRotation }

/** A page list the source cannot produce; the message is for the user. */
export class PageListError extends Error {
  override name = "PageListError"
}

const ROTATIONS = new Set([0, 90, 180, 270])

/** Attributes a page may inherit from the page tree nodes above it. */
const INHERITABLE = ["Resources", "MediaBox", "CropBox", "Rotate"].map((key) =>
  PDFName.of(key)
)

function isIdentity(list: PageEdit[], pageCount: number) {
  if (list.length !== pageCount) return false
  return list.every((entry, index) => {
    return entry.page === index && entry.rotation === 0
  })
}

/**
 * Checks that `list` keeps at least one page, names only pages of a
 * `pageCount`-page document, each once, with a quarter-turn rotation, and
 * changes something. Throws a `PageListError` otherwise.
 */
export function assertPageList(list: PageEdit[], pageCount: number) {
  if (list.length === 0) {
    throw new PageListError(
      "El documento tiene que conservar al menos una página"
    )
  }
  const seen = new Set<number>()
  for (const entry of list) {
    if (
      !Number.isInteger(entry.page) ||
      entry.page < 0 ||
      entry.page >= pageCount
    ) {
      throw new PageListError(`El documento no tiene página ${entry.page + 1}`)
    }
    if (seen.has(entry.page)) {
      throw new PageListError(`La página ${entry.page + 1} aparece dos veces`)
    }
    if (!ROTATIONS.has(entry.rotation)) {
      throw new PageListError("Las páginas solo se giran de 90 en 90 grados")
    }
    seen.add(entry.page)
  }
  if (isIdentity(list, pageCount)) {
    throw new PageListError("No hay cambios en las páginas que guardar")
  }
}

/** Copies the attributes the leaf inherits onto it, so it can be moved. */
function pinInherited(page: PDFPageLeaf) {
  for (const name of INHERITABLE) {
    if (page.has(name)) continue
    const value = page.getInheritableAttribute(name)
    if (value !== undefined) page.set(name, value)
  }
}

function childrenOf(object: PDFObject): PDFObject[] {
  if (object instanceof PDFDict) {
    return object.entries().map(([, value]) => value)
  }
  if (object instanceof PDFArray) return object.asArray()
  if (object instanceof PDFStream) return childrenOf(object.dict)
  return []
}

/**
 * Deletes every indirect object the trailer no longer reaches, so the
 * content of removed pages does not survive in the saved file.
 */
function dropUnreachable(doc: PDFDocument) {
  const { context } = doc
  const reached = new Set<string>()
  const pending: PDFObject[] = []
  const { Root, Info, ID } = context.trailerInfo
  for (const object of [Root, Info, ID]) {
    if (object !== undefined) pending.push(object)
  }
  while (pending.length > 0) {
    const object = pending.pop()
    if (object === undefined) break
    if (object instanceof PDFRef) {
      const key = object.toString()
      if (reached.has(key)) continue
      reached.add(key)
      const target = context.lookup(object)
      if (target !== undefined) pending.push(target)
      continue
    }
    for (const child of childrenOf(object)) pending.push(child)
  }
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reached.has(ref.toString())) context.delete(ref)
  }
}

function normalizedAngle(angle: number) {
  return ((angle % 360) + 360) % 360
}

/**
 * Rebuilds the document's pages as `list` says (see `assertPageList`), in
 * place so the catalog (metadata, outlines, viewer preferences, attachments)
 * survives, and saves it with a full rewrite. Removed pages are dropped from
 * the file, and the page tree is flattened under its root.
 */
export async function rewritePages(bytes: Uint8Array, list: PageEdit[]) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const pages = doc.getPages()
  assertPageList(list, pages.length)

  const root = doc.catalog.Pages()
  const rootRef = doc.catalog.get(PDFName.of("Pages"))
  if (!(rootRef instanceof PDFRef)) {
    throw new Error("The page tree root is not an indirect object")
  }

  for (const page of pages) pinInherited(page.node)
  const kept = new Set(list.map((entry) => entry.page))
  const refs: PDFRef[] = []
  for (const entry of list) {
    const page = pages[entry.page]
    if (!page) continue
    page.node.setParent(rootRef)
    page.setRotation(
      degrees(normalizedAngle(page.getRotation().angle + entry.rotation))
    )
    refs.push(page.ref)
  }
  root.set(PDFName.of("Kids"), doc.context.obj(refs))
  root.set(PDFName.of("Count"), PDFNumber.of(refs.length))
  for (const [index, page] of pages.entries()) {
    if (!kept.has(index)) doc.context.delete(page.ref)
  }
  dropUnreachable(doc)

  return doc.save({ useObjectStreams: false })
}

/**
 * Concatenates every page of each source, in order, into a new document.
 * Interactive form fields are not merged: their widgets stay as appearances.
 */
export async function mergePdfs(sources: Uint8Array[]) {
  const merged = await PDFDocument.create()
  for (const source of sources) {
    const doc = await PDFDocument.load(source, { updateMetadata: false })
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    for (const page of pages) merged.addPage(page)
  }
  return merged.save({ useObjectStreams: false })
}

/** Whether the PDF has a signature field holding a signature. */
export async function hasEmbeddedSignature(bytes: Uint8Array<ArrayBuffer>) {
  const signatures = await extractSignatures(bytes)
  return signatures.length > 0
}
