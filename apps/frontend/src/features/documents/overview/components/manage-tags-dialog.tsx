import { getIcon } from "@/lib/icon-registry"

const DeleteIcon = getIcon("actions", "delete")

import { type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  type DocumentTag,
  documentLabels,
  useDocumentTagCreate,
  useDocumentTagDelete,
  useDocumentTags,
  useDocumentTagUpdate,
} from "@/features/documents/shared"
import {
  type EntityIconColor,
  ICON_PALETTE,
  IconColorSwatches,
} from "@/features/entity-icons"
import { useOnOpen } from "@/hooks/use-on-open"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { cn } from "@/lib/utils"

const NEW_NAME_ID = "manage-tags-name"

// A tag's color as a dot that opens the swatches.
function TagColorButton({
  tag,
  onChange,
}: {
  tag: DocumentTag
  onChange: (color: EntityIconColor) => void
}) {
  const [open, setOpen] = useState(false)
  const label = `${documentLabels.tagColor}: ${tag.name}`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label={documentLabels.tagColor}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
            />
          }
        >
          <span
            aria-hidden
            className={cn(
              "size-3 rounded-full",
              ICON_PALETTE[tag.color].swatch
            )}
          />
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="start" className="w-auto p-3">
        <IconColorSwatches
          value={tag.color}
          onChange={(color) => {
            onChange(color)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// The name reads as text and edits in place; it saves on blur or Enter.
function TagRow({
  tag,
  onDelete,
}: {
  tag: DocumentTag
  onDelete: (tag: DocumentTag) => void
}) {
  const update = useDocumentTagUpdate()
  const [name, setName] = useState(tag.name)

  const saveName = () => {
    const trimmed = name.trim()
    if (trimmed === "" || trimmed === tag.name) {
      setName(tag.name)
      return
    }
    update.mutate(
      { id: tag.id, name: trimmed },
      { onError: () => setName(tag.name) }
    )
  }

  return (
    <li className="flex min-h-12 items-center gap-2 py-1.5">
      <TagColorButton
        tag={tag}
        onChange={(color) => update.mutate({ id: tag.id, color })}
      />
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => {
          // Enter saves this row instead of submitting the new-tag form.
          if (event.key !== "Enter") return
          event.preventDefault()
          event.currentTarget.blur()
        }}
        aria-label={`${documentLabels.tagName}: ${tag.name}`}
        maxLength={50}
        className="h-9 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
      />
      <Text
        variant="compact"
        tone="muted"
        className="shrink-0 whitespace-nowrap tabular-nums"
      >
        {documentLabels.documentCount(tag.documentCount)}
      </Text>
      <Hint label={documentLabels.deleteTagTitle}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${documentLabels.delete} ${tag.name}`}
          onClick={() => onDelete(tag)}
        >
          <DeleteIcon aria-hidden />
        </Button>
      </Hint>
    </li>
  )
}

/**
 * Creates tags (the dialog's form) and lists the existing ones below a
 * hairline, each renamed in place, recolored from its dot or deleted.
 */
export function ManageTagsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: tags = [] } = useDocumentTags()
  const create = useDocumentTagCreate()
  const remove = useDocumentTagDelete()
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState<EntityIconColor>("neutral")
  const [createError, setCreateError] = useState<string | null>(null)

  useOnOpen(open, () => {
    setNewName("")
    setNewColor("neutral")
    setCreateError(null)
  })

  const deleteDialog = useTargetConfirmDialog<DocumentTag>({
    title: documentLabels.deleteTagTitle,
    description: (tag) =>
      documentLabels.deleteTagDescription(tag.name, tag.documentCount),
    confirmLabel: documentLabels.delete,
    onConfirm: (tag) => remove.mutateAsync({ id: tag.id }),
  })

  // Creating keeps the dialog open, ready for the next tag.
  const handleCreate = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newName.trim()
    if (name === "") return
    try {
      await create.mutateAsync({ name, color: newColor })
    } catch (error) {
      if (error instanceof Error) setCreateError(error.message)
      return
    }
    setNewName("")
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={documentLabels.manageTags}
        description={documentLabels.manageTagsDescription}
        onSubmit={handleCreate}
        isPending={create.isPending}
        submitDisabled={newName.trim() === ""}
        submitLabel={documentLabels.createTag}
        cancelLabel={documentLabels.close}
      >
        <FormField label={documentLabels.newTag} htmlFor={NEW_NAME_ID}>
          <Input
            id={NEW_NAME_ID}
            value={newName}
            onChange={(event) => {
              setNewName(event.target.value)
              setCreateError(null)
            }}
            placeholder={documentLabels.newTagPlaceholder}
            aria-invalid={createError !== null}
            maxLength={50}
            autoFocus
          />
        </FormField>
        <FormField label={documentLabels.tagColor}>
          <IconColorSwatches value={newColor} onChange={setNewColor} />
        </FormField>
        {createError ? (
          <Text as="p" variant="meta" tone="destructive" role="alert">
            {createError}
          </Text>
        ) : null}

        <section className="-mx-6 space-y-2 border-t px-6 pt-5">
          <SectionHeading title={documentLabels.yourTags} count={tags.length} />
          {tags.length > 0 ? (
            <>
              <Text as="p" variant="meta" tone="muted">
                {documentLabels.tagEditHint}
              </Text>
              <ul className="max-h-72 divide-y overflow-y-auto">
                {tags.map((tag) => (
                  <TagRow key={tag.id} tag={tag} onDelete={deleteDialog.open} />
                ))}
              </ul>
            </>
          ) : (
            <Text as="p" variant="meta" tone="muted">
              {documentLabels.noTags}
            </Text>
          )}
        </section>
      </FormDialog>
      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
