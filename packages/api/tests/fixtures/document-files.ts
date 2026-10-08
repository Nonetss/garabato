/** PDF test files made by `documents/generate.sh`. */
export type PdfFixture =
  | "plain"
  | "rotated"
  | "cropped"
  | "mixed-sizes"
  | "encrypted"
  | "not-a-pdf"

export async function pdfFixture(
  name: PdfFixture
): Promise<Uint8Array<ArrayBuffer>> {
  const file = Bun.file(`${import.meta.dir}/documents/${name}.pdf`)
  return new Uint8Array(await file.arrayBuffer())
}
