/**
 * Builds the test PDFs with @cantoo/pdf-lib. Run by generate.sh, which then
 * encrypts one copy with qpdf. Nothing here is real data.
 */
import {
  degrees,
  PDFDocument,
  type PDFPage,
  StandardFonts,
} from "@cantoo/pdf-lib"

const [outDir] = process.argv.slice(2)
if (!outDir) throw new Error("usage: build <out>")

const A4: [number, number] = [595.28, 841.89]
const A5: [number, number] = [419.53, 595.28]

async function contract(sizes: [number, number][]) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages: PDFPage[] = []
  for (const [index, size] of sizes.entries()) {
    const page = doc.addPage(size)
    page.drawText(`Contrato de prueba · página ${index + 1}`, {
      x: 40,
      y: size[1] - 60,
      size: 12,
      font,
    })
    pages.push(page)
  }
  return { doc, pages }
}

async function write(name: string, doc: PDFDocument) {
  // Classic xref tables for some, object streams for others: both must sign.
  await Bun.write(
    `${outDir}/${name}`,
    await doc.save({ useObjectStreams: name !== "plain.pdf" })
  )
}

const plain = await contract([A4, A4, A4])
await write("plain.pdf", plain.doc)

const rotated = await contract([A4, A4])
rotated.pages[1]?.setRotation(degrees(90))
await write("rotated.pdf", rotated.doc)

const cropped = await contract([A4])
cropped.pages[0]?.setCropBox(50, 100, 400, 600)
await write("cropped.pdf", cropped.doc)

const mixed = await contract([A4, A5])
await write("mixed-sizes.pdf", mixed.doc)
