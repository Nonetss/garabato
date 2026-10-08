import { Text } from "@/components/shared/brand/typography"
import type { DocumentTag } from "@/features/documents/shared/model/types"
import { ICON_PALETTE } from "@/features/entity-icons"
import { cn } from "@/lib/utils"

/** One tag: its palette dot and its name. */
export function TagChip({ tag }: { tag: Pick<DocumentTag, "name" | "color"> }) {
  return (
    <li className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          ICON_PALETTE[tag.color].swatch
        )}
      />
      <Text variant="compact" className="truncate">
        {tag.name}
      </Text>
    </li>
  )
}

/**
 * A document's tags as small chips, at most `max` followed by "+N". Ids of
 * tags not (or not yet) in `tags` are skipped.
 */
export function TagChips({
  tagIds,
  tags,
  max = 3,
  className,
}: {
  tagIds: string[]
  tags: Map<string, DocumentTag>
  max?: number
  className?: string
}) {
  const known: DocumentTag[] = []
  for (const tagId of tagIds) {
    const tag = tags.get(tagId)
    if (tag) known.push(tag)
  }
  if (known.length === 0) return null

  const shown = known.slice(0, max)
  const hidden = known.length - shown.length
  return (
    <ul
      aria-label="Etiquetas"
      className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}
    >
      {shown.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {hidden > 0 ? (
        <li>
          <Text variant="compact" tone="muted" className="tabular-nums">
            +{hidden}
          </Text>
        </li>
      ) : null}
    </ul>
  )
}
