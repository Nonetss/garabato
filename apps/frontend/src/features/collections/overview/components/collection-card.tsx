import type { CSSProperties } from "react"
import { Text } from "@/components/shared/brand/typography"
import { RowActionsMenu } from "@/components/shared/data-display/row-actions-menu"
import { AppLink } from "@/components/ui/app-link"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { Collection } from "@/features/collections/shared/model/types"
import { EntityIcon, type EntityIconValue } from "@/features/entity-icons"
import { formatDate } from "@/lib/format"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const CustomCollection = getIcon("collections", "custom")
const ChevronRight = getIcon("controls", "next")
const Edit = getIcon("actions", "edit")
const Delete = getIcon("actions", "delete")

const MAX_STAGGER_INDEX = 12

export function CollectionCard({
  collection,
  icon,
  index,
  onEdit,
  onDelete,
  className,
}: {
  collection: Collection
  icon: EntityIconValue | null
  index: number
  onEdit: (collection: Collection) => void
  onDelete: (collection: Collection) => void
  className?: string
}) {
  const name = collection.name ?? "Colección sin nombre"
  const href = `/collections/custom/${collection.id}`

  return (
    <article
      className={cn(
        "group dash-enter relative flex flex-col gap-3 rounded-xl border bg-card/40 p-4",
        "transition-colors duration-200 hover:border-foreground/15 hover:bg-muted has-focus-visible:border-foreground/15 has-focus-visible:bg-muted",
        className
      )}
      style={
        {
          "--dash-delay": `${Math.min(index, MAX_STAGGER_INDEX) * 40}ms`,
        } as CSSProperties
      }
    >
      <AppLink
        href={href}
        aria-label={name}
        className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 items-start gap-2.5">
        <span aria-hidden className="shrink-0">
          <EntityIcon
            value={icon}
            fallback={CustomCollection}
            className="size-5"
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text as="h2" variant="title" className="truncate">
            {name}
          </Text>
          {/* Always two lines tall so footers line up across a grid row. */}
          <Text
            as="p"
            variant="compact"
            tone="muted"
            className="line-clamp-2 min-h-[3.25em] leading-relaxed"
          >
            {collection.description ?? "Sin descripción"}
          </Text>
        </div>
        <div className="pointer-events-auto relative z-20 -mt-1 -mr-1 shrink-0">
          <RowActionsMenu label={`Acciones para ${name}`}>
            <DropdownMenuItem
              aria-label={`Editar ${name}`}
              onClick={() => onEdit(collection)}
            >
              <Edit className="size-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              aria-label={`Eliminar ${name}`}
              onClick={() => onDelete(collection)}
            >
              <Delete className="size-4" />
              Eliminar
            </DropdownMenuItem>
          </RowActionsMenu>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2 border-t pt-2.5">
        <Text as="p" variant="meta-sm" tone="muted">
          Actualizada{" "}
          <span className="tabular-nums">
            {formatDate(collection.updatedAt)}
          </span>
        </Text>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </div>
    </article>
  )
}

export function CollectionCardGrid({
  collections,
  iconFor,
  onEdit,
  onDelete,
  className,
}: {
  collections: Collection[]
  iconFor: (collection: Collection) => EntityIconValue | null
  onEdit: (collection: Collection) => void
  onDelete: (collection: Collection) => void
  className?: string
}) {
  // Same container breakpoints as `SurfaceCardGrid`: columns follow the
  // space next to the sidebar, not the viewport.
  return (
    <div className={cn("@container", className)}>
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4 @min-[90rem]:grid-cols-5">
        {collections.map((collection, index) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            icon={iconFor(collection)}
            index={index}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
