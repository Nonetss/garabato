import { useState } from "react"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  useAddCollectionItem,
  useCreateCollection,
  useRemoveCollectionItem,
} from "@/features/collections/save/hooks/use-collection-mutations"
import {
  useCollectionMemberships,
  useCollections,
} from "@/features/collections/save/hooks/use-collections"
import type { CollectionEntityRef } from "@/features/collections/shared/model/types"
import { getIcon } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

const BookmarkPlus = getIcon("collections", "save")
const Plus = getIcon("actions", "add")

interface CollectionButtonProps {
  entity: CollectionEntityRef
  className?: string
  label?: string
  compact?: boolean
}

export function CollectionButton({
  entity,
  className,
  label = "Guardar",
  compact = false,
}: CollectionButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(
    null
  )
  const collections = useCollections(open)
  const memberships = useCollectionMemberships(entity)
  const createCollection = useCreateCollection()
  const addItem = useAddCollectionItem()
  const removeItem = useRemoveCollectionItem()
  const membershipIds = new Set(memberships.data?.map((item) => item.id))
  const saved = membershipIds.size > 0

  const toggleMembership = async (collectionId: string, selected: boolean) => {
    setPendingCollectionId(collectionId)
    try {
      if (selected) {
        await addItem.mutateAsync({ collectionId, ...entity })
      } else {
        await removeItem.mutateAsync({ collectionId, ...entity })
      }
    } finally {
      setPendingCollectionId(null)
    }
  }

  const createCollectionWithItem = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const created = await createCollection.mutateAsync({ name: trimmedName })
    await addItem.mutateAsync({ collectionId: created.id, ...entity })
    setName("")
  }

  const isLoading = collections.isPending || memberships.isPending
  const isError = collections.isError || memberships.isError

  const trigger = (
    <PopoverTrigger
      render={
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon-sm" : "sm"}
          className={cn(
            "text-muted-foreground",
            saved && "text-rose-500 hover:text-rose-600 dark:text-rose-400",
            className
          )}
          aria-label={label}
          aria-pressed={saved}
        />
      }
    >
      <BookmarkPlus
        data-icon={compact ? undefined : "inline-start"}
        className={saved ? "fill-current" : undefined}
        aria-hidden="true"
      />
      {compact ? null : <span>{label}</span>}
    </PopoverTrigger>
  )

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Event boundary prevents portaled popover interactions from triggering an enclosing card or row.
    <span
      className="contents"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Popover open={open} onOpenChange={setOpen}>
        {compact ? <Hint label={label}>{trigger}</Hint> : trigger}
        <PopoverContent className="w-80 p-0" align="end">
          <PopoverHeader className="px-4 pt-4 pb-3">
            <PopoverTitle>Guardar en una colección</PopoverTitle>
            <PopoverDescription>
              Marca las listas donde quieres guardar este recurso.
            </PopoverDescription>
          </PopoverHeader>
          <Separator />
          <div className="max-h-56 overflow-y-auto p-2">
            {isLoading ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Cargando colecciones…
              </p>
            ) : null}
            {isError ? (
              <p className="px-2 py-4 text-center text-sm text-destructive">
                No se pudieron cargar las colecciones.
              </p>
            ) : null}
            {!isLoading && !isError && collections.data?.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Crea tu primera colección para guardar este recurso.
              </p>
            ) : null}
            {!isLoading && !isError
              ? collections.data?.map((item) => {
                  const checked = membershipIds.has(item.id)
                  const checkboxId = `collection-${item.id}`
                  const pending = pendingCollectionId === item.id

                  return (
                    <div
                      key={item.id}
                      className="flex min-h-9 items-center gap-3 rounded-md px-2 hover:bg-accent"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        disabled={pending}
                        onCheckedChange={(next) => {
                          void toggleMembership(item.id, next === true)
                        }}
                      />
                      <label
                        htmlFor={checkboxId}
                        className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                      >
                        {item.name ?? "Favoritos"}
                      </label>
                    </div>
                  )
                })
              : null}
          </div>
          <Separator />
          <form
            className="flex gap-2 p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void createCollectionWithItem()
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nueva colección"
              maxLength={120}
              aria-label="Nombre de la nueva colección"
            />
            <Button
              type="submit"
              size="icon"
              disabled={
                !name.trim() || createCollection.isPending || addItem.isPending
              }
              aria-label="Crear colección y guardar recurso"
            >
              <Plus aria-hidden="true" />
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </span>
  )
}
