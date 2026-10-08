import { getIcon } from "@/lib/icon-registry"

const AddIcon = getIcon("actions", "add")

import { type SyntheticEvent, useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { documentLabels } from "@/features/documents/shared/definitions/document-labels"
import {
  useDocumentTagCreate,
  useDocumentTags,
} from "@/features/documents/shared/hooks/use-document-tags"
import { useDocumentsUpdateTags } from "@/features/documents/shared/hooks/use-documents"
import {
  initialTagStates,
  type TagState,
  tagChanges,
} from "@/features/documents/shared/model/tag-states"
import type { DocumentSummary } from "@/features/documents/shared/model/types"
import { ICON_PALETTE } from "@/features/entity-icons"
import { useOnOpen } from "@/hooks/use-on-open"
import { foldText } from "@/lib/fold-text"
import { cn } from "@/lib/utils"

const SEARCH_ID = "document-tags-search"

/**
 * Adds and removes tags on one or several documents. A tag carried by every
 * document starts checked, by some of them indeterminate; saving changes only
 * the tags the user toggled. Typing a name that no tag has offers to create
 * it, already checked.
 */
export function DocumentTagsDialog({
  open,
  onOpenChange,
  documents,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: Pick<DocumentSummary, "id" | "tagIds">[]
  onSaved?: () => void
}) {
  const { data: tags = [] } = useDocumentTags()
  const createTag = useDocumentTagCreate()
  const updateTags = useDocumentsUpdateTags()
  const [initial, setInitial] = useState<Map<string, TagState>>(new Map())
  const [draft, setDraft] = useState<Map<string, TagState>>(new Map())
  const [search, setSearch] = useState("")

  useOnOpen(open, () => {
    const states = initialTagStates(documents)
    setInitial(states)
    setDraft(new Map(states))
    setSearch("")
  })

  const stateOf = (tagId: string): TagState => draft.get(tagId) ?? "off"
  // A mixed tag turns on first: one click puts it on every document.
  const toggle = (tagId: string) => {
    setDraft((current) => {
      const before = current.get(tagId) ?? "off"
      const after: TagState = before === "on" ? "off" : "on"
      return new Map(current).set(tagId, after)
    })
  }

  const query = search.trim()
  const folded = foldText(query)
  const visible = tags.filter((tag) => foldText(tag.name).includes(folded))
  const exists = tags.some(
    (tag) => foldText(tag.name) === folded && query !== ""
  )

  const create = async () => {
    if (query === "" || exists) return
    const tag = await createTag.mutateAsync({ name: query })
    setDraft((current) => new Map(current).set(tag.id, "on"))
    setSearch("")
  }

  const changes = tagChanges(initial, draft)
  const hasChanges = changes.add.length + changes.remove.length > 0

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasChanges) {
      onOpenChange(false)
      return
    }
    await updateTags.mutateAsync({
      ids: documents.map((document) => document.id),
      ...changes,
    })
    onSaved?.()
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={documentLabels.tagsTitle(documents.length)}
      onSubmit={handleSubmit}
      isPending={updateTags.isPending}
      submitLabel={documentLabels.save}
    >
      <Input
        id={SEARCH_ID}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          // Enter creates the typed tag instead of submitting the dialog.
          if (event.key !== "Enter" || query === "" || exists) return
          event.preventDefault()
          void create()
        }}
        placeholder={documentLabels.tagSearch}
        aria-label={documentLabels.tagSearch}
        maxLength={50}
        autoFocus
      />

      <ul className="-mx-2 max-h-72 space-y-0.5 overflow-y-auto">
        {visible.map((tag) => {
          const state = stateOf(tag.id)
          return (
            <li
              key={tag.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
            >
              <Checkbox
                id={`document-tag-${tag.id}`}
                checked={state === "on"}
                indeterminate={state === "mixed"}
                onCheckedChange={() => toggle(tag.id)}
              />
              <label
                htmlFor={`document-tag-${tag.id}`}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    ICON_PALETTE[tag.color].swatch
                  )}
                />
                <Text variant="title" className="min-w-0 flex-1 truncate">
                  {tag.name}
                </Text>
                <Text variant="compact" tone="muted" className="tabular-nums">
                  {tag.documentCount}
                </Text>
              </label>
            </li>
          )
        })}
        {query !== "" && !exists ? (
          <li>
            <button
              type="button"
              onClick={() => void create()}
              disabled={createTag.isPending}
              className={cn(
                textVariants({ role: "title" }),
                "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50 disabled:opacity-50"
              )}
            >
              <AddIcon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">
                {documentLabels.createTagNamed(query)}
              </span>
            </button>
          </li>
        ) : null}
      </ul>

      {tags.length === 0 && query === "" ? (
        <Text as="p" variant="meta" tone="muted">
          {documentLabels.noTags}
        </Text>
      ) : null}
    </FormDialog>
  )
}
