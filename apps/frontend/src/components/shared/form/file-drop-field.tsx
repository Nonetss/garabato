import { getIcon } from "@/lib/icon-registry"

const UploadIcon = getIcon("actions", "upload")
const RemoveIcon = getIcon("controls", "close")

import {
  type ChangeEvent,
  type ComponentType,
  type DragEvent,
  type ReactNode,
  useRef,
  useState,
} from "react"
import { Text } from "@/components/shared/brand/typography"
import { IconButton } from "@/components/shared/form/icon-button"
import { formatFileSize } from "@/lib/format"
import { cn } from "@/lib/utils"

const EMPTY_SURFACE =
  "flex-col items-center gap-3 border-dashed border-border px-6 py-8 text-center hover:border-primary/40 hover:bg-muted/30"
const PICKED_SURFACE =
  "items-center gap-3 border-border bg-muted/30 py-3 pr-14 pl-3 hover:bg-muted/50"

export interface FileDropFieldProps {
  /** Id of the hidden file input, for an outer `<label htmlFor>`. */
  id: string
  accept: string
  file: File | null
  onFileChange: (file: File | null) => void
  /** Main line of the empty zone ("Arrastra el PDF o haz clic…"). */
  prompt: ReactNode
  /** Quiet line under the prompt: format and size limits. */
  requirements?: ReactNode
  /** Icon of the picked file's chip. */
  fileIcon: ComponentType<{ className?: string }>
  disabled?: boolean
  changeLabel?: string
  removeLabel?: string
}

/**
 * Single-file picker drawn as a dashed drop zone. A file can be dropped on it
 * or chosen with the native dialog (click, or Enter/Space on the focused
 * input); once picked, the zone turns into a chip with the name, the size and
 * a remove button. The real `<input type="file">` stays in the DOM, visually
 * hidden, so keyboard and screen-reader behavior are the browser's own.
 * Validation (type, size) stays with the caller.
 */
export function FileDropField({
  id,
  accept,
  file,
  onFileChange,
  prompt,
  requirements,
  fileIcon: FileIcon,
  disabled = false,
  changeLabel = "Cambiar",
  removeLabel = "Quitar archivo",
}: FileDropFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (picked) onFileChange(picked)
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (disabled) return
    event.dataTransfer.dropEffect = "copy"
    setDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = event.dataTransfer.files[0]
    if (dropped) onFileChange(dropped)
  }

  const handleRemove = () => {
    // Let the same file be picked again right after removing it.
    if (inputRef.current) inputRef.current.value = ""
    onFileChange(null)
    inputRef.current?.focus()
  }

  const surface = file ? PICKED_SURFACE : EMPTY_SURFACE

  return (
    <div className="relative">
      <label
        htmlFor={id}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-dragging={dragging || undefined}
        className={cn(
          "flex cursor-pointer rounded-md border-[1.5px] transition-colors duration-200",
          "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
          "data-dragging:border-primary/60 data-dragging:bg-primary/5",
          disabled && "pointer-events-none opacity-50",
          surface
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={handleChange}
        />
        {file ? (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileIcon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <Text variant="title" className="truncate">
                {file.name}
              </Text>
              <Text variant="meta" tone="muted">
                {formatFileSize(file.size)} ·{" "}
                <span className="text-primary underline-offset-4 hover:underline">
                  {changeLabel}
                </span>
              </Text>
            </span>
          </>
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadIcon className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <Text variant="title" className="text-balance">
                {prompt}
              </Text>
              {requirements ? (
                <Text variant="meta" tone="muted">
                  {requirements}
                </Text>
              ) : null}
            </span>
          </>
        )}
      </label>
      {file ? (
        <IconButton
          label={removeLabel}
          icon={RemoveIcon}
          disabled={disabled}
          onClick={handleRemove}
          className="absolute top-1/2 right-3 -translate-y-1/2"
        />
      ) : null}
    </div>
  )
}
