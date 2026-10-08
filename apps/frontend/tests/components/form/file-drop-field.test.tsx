import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { FileDropField } from "@/components/shared/form/file-drop-field"

const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} />
)

const pdf = new File(["x".repeat(2048)], "contrato.pdf", {
  type: "application/pdf",
})

function renderField(file: File | null, onFileChange = mock(() => {})) {
  render(
    <FileDropField
      id="file"
      accept=".pdf"
      file={file}
      onFileChange={onFileChange}
      prompt="Arrastra el PDF aquí"
      requirements="PDF · hasta 20 MB"
      fileIcon={FileIcon}
    />
  )
  return onFileChange
}

function fileInput() {
  const input = document.getElementById("file")
  if (!(input instanceof HTMLInputElement)) throw new Error("no file input")
  return input
}

afterEach(() => {
  cleanup()
})

describe("FileDropField", () => {
  test("shows the prompt and requirements while empty", () => {
    renderField(null)

    expect(screen.getByText("Arrastra el PDF aquí")).toBeDefined()
    expect(screen.getByText("PDF · hasta 20 MB")).toBeDefined()
    expect(screen.queryByRole("button", { name: "Quitar archivo" })).toBeNull()
  })

  test("reports a file picked with the native input", () => {
    const onFileChange = renderField(null)

    fireEvent.change(fileInput(), { target: { files: [pdf] } })
    expect(onFileChange).toHaveBeenCalledWith(pdf)
  })

  test("reports a dropped file", () => {
    const onFileChange = renderField(null)

    const zone = screen.getByText("Arrastra el PDF aquí").closest("label")
    if (!zone) throw new Error("no drop zone")
    fireEvent.drop(zone, { dataTransfer: { files: [pdf] } })
    expect(onFileChange).toHaveBeenCalledWith(pdf)
  })

  test("shows the picked file's name and size", () => {
    renderField(pdf)

    expect(screen.getByText("contrato.pdf")).toBeDefined()
    expect(screen.getByText(/2 KB/)).toBeDefined()
    expect(screen.queryByText("Arrastra el PDF aquí")).toBeNull()
  })

  test("clears the file with the remove button", () => {
    const onFileChange = renderField(pdf)

    fireEvent.click(screen.getByRole("button", { name: "Quitar archivo" }))
    expect(onFileChange).toHaveBeenCalledWith(null)
  })
})
