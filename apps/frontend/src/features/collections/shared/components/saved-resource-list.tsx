import { type ReactNode, type SyntheticEvent, useEffect, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { StateCard } from "@/components/shared/feedback/state-card"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateCollectionItem } from "@/features/collections/save"
import { formatDateTime } from "@/lib/format"
import { getIcon } from "@/lib/icon-registry"

const Bookmark = getIcon("collections", "save")
const Pencil = getIcon("actions", "edit")

type SavedResource = {
  id: string
  entityType: string
  entityId: string
  metadata?: {
    title?: string
    description?: string
    href?: string
    image?: string
  } | null
  createdAt?: string
}

function humanizeEntityType(entityType: string) {
  return entityType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function ResourceMetadataDialog<T extends SavedResource>({
  resource,
  open,
  onOpenChange,
}: {
  resource: T | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateItem = useUpdateCollectionItem()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [href, setHref] = useState("")
  const [image, setImage] = useState("")

  useEffect(() => {
    if (!open) return
    setTitle(resource?.metadata?.title ?? "")
    setDescription(resource?.metadata?.description ?? "")
    setHref(resource?.metadata?.href ?? "")
    setImage(resource?.metadata?.image ?? "")
  }, [open, resource])

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!resource) return

    await updateItem.mutateAsync({
      id: resource.id,
      metadata: {
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(href.trim() ? { href: href.trim() } : {}),
        ...(image.trim() ? { image: image.trim() } : {}),
      },
    })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar información"
      description="Personaliza cómo aparece este recurso en tus colecciones."
      onSubmit={handleSubmit}
      isPending={updateItem.isPending}
      submitLabel="Guardar cambios"
    >
      <FormField label="Título" htmlFor="saved-resource-title">
        <Input
          id="saved-resource-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nombre visible del recurso"
          maxLength={240}
        />
      </FormField>
      <FormField label="Descripción" htmlFor="saved-resource-description">
        <Textarea
          id="saved-resource-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Una breve descripción opcional"
          maxLength={1000}
          rows={3}
        />
      </FormField>
      <FormField label="Enlace" htmlFor="saved-resource-href">
        <Input
          id="saved-resource-href"
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder="/ruta-del-recurso"
          maxLength={2000}
        />
      </FormField>
      <FormField label="Imagen" htmlFor="saved-resource-image">
        <Input
          id="saved-resource-image"
          value={image}
          onChange={(event) => setImage(event.target.value)}
          placeholder="https://… o /images/recurso.jpg"
          maxLength={2000}
        />
      </FormField>
    </FormDialog>
  )
}

export function SavedResourceList<T extends SavedResource>({
  resources,
  action,
  emptyTitle,
  emptyDescription,
}: {
  resources: T[]
  action?: (resource: T) => ReactNode
  emptyTitle: string
  emptyDescription: string
}) {
  const [editingResource, setEditingResource] = useState<T | null>(null)

  if (resources.length === 0) {
    return (
      <StateCard
        icon={<Bookmark className="size-6" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <>
      <div className="@container min-w-0">
        <ul className="grid gap-3 @xl:grid-cols-2">
          {resources.map((resource) => {
            const metadata = resource.metadata
            const title =
              metadata?.title ?? humanizeEntityType(resource.entityType)
            const href = metadata?.href ?? null
            const content = (
              <div className="min-w-0">
                <Text as="p" variant="title" className="truncate">
                  {title}
                </Text>
                {metadata?.description ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                    {metadata.description}
                  </p>
                ) : null}
                <Text
                  as="p"
                  variant="compact"
                  className="mt-2 truncate text-muted-foreground/70"
                >
                  {resource.createdAt
                    ? `Guardado ${formatDateTime(resource.createdAt)}`
                    : `${humanizeEntityType(resource.entityType)} · ${resource.entityId}`}
                </Text>
              </div>
            )

            return (
              <li
                key={resource.id}
                className="dash-enter flex min-w-0 items-center gap-3 rounded-xl border bg-card/40 p-4 transition-colors hover:bg-muted/40"
              >
                {metadata?.image ? (
                  <img
                    src={metadata.image}
                    alt=""
                    className="size-11 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center border bg-muted/40 text-primary">
                    <Bookmark className="size-4" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {href ? (
                    <AppLink
                      href={href}
                      className="block rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {content}
                    </AppLink>
                  ) : (
                    content
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Hint label="Editar información">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar información de ${title}`}
                      onClick={() => setEditingResource(resource)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </Hint>
                  {action ? action(resource) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <ResourceMetadataDialog
        resource={editingResource}
        open={editingResource !== null}
        onOpenChange={(open) => {
          if (!open) setEditingResource(null)
        }}
      />
    </>
  )
}
