import { getIcon } from "@/lib/icon-registry"

const Pencil = getIcon("actions", "edit")
const Trash = getIcon("actions", "delete")
const CustomCollection = getIcon("collections", "custom")
const ArrowLeft = getIcon("navigation", "back")

import { textVariants } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { StateCard } from "@/components/shared/feedback/state-card"
import { PageHero } from "@/components/shared/layout/page-hero"
import { PageShell } from "@/components/shared/layout/page-shell"
import { AppBackLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CollectionFormDialog } from "@/features/collections/overview/components/collection-form-dialog"
import {
  useCollectionItems,
  useCollections,
  useDeleteCollection,
  useRemoveCollectionItem,
} from "@/features/collections/save"
import { SavedResourceList } from "@/features/collections/shared/components/saved-resource-list"
import { collectionIconRef } from "@/features/collections/shared/model/icon"
import type { Collection } from "@/features/collections/shared/model/types"
import { EntityIcon, useEntityIcons } from "@/features/entity-icons"
import { useEditDialog } from "@/hooks/use-edit-dialog"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { navigate } from "@/lib/navigate"

export function CollectionDetailContent({
  collectionId,
}: {
  collectionId: string
}) {
  const collections = useCollections()
  const items = useCollectionItems(collectionId)
  const deleteCollection = useDeleteCollection()
  const removeItem = useRemoveCollectionItem()
  const editDialog = useEditDialog<Collection>()
  const collection = collections.data?.find((item) => item.id === collectionId)
  const icons = useEntityIcons([collectionIconRef(collectionId)])
  const icon = icons.iconFor(collectionIconRef(collectionId))
  const deleteDialog = useTargetConfirmDialog<Collection>({
    title: "Eliminar colección",
    description: (target) =>
      `Eliminar “${target.name}” también quitará todos sus recursos guardados. Esta acción no se puede deshacer.`,
    confirmLabel: "Eliminar colección",
    onConfirm: async (target) => {
      await deleteCollection.mutateAsync({ id: target.id })
      navigate("/collections/custom")
    },
  })

  if (collections.isPending) {
    return (
      <PageShell maxWidth="80%">
        <StateCard spinner title="Cargando colección..." />
      </PageShell>
    )
  }

  if (collections.isError || !collection || collection.kind !== "custom") {
    return (
      <PageShell maxWidth="80%">
        <StateCard
          title="Colección no encontrada"
          description="Puede que se haya eliminado o que no tengas acceso a ella."
          tone="destructive"
        />
      </PageShell>
    )
  }

  return (
    <>
      <PageShell maxWidth="80%">
        <div className="flex min-h-0 flex-1 flex-col gap-8">
          <div className="flex flex-col gap-3">
            <AppBackLink
              href="/collections/custom"
              className={textVariants({
                role: "status",
                tone: "muted",
                className:
                  "-ml-1 inline-flex w-fit items-center gap-1 transition-colors hover:text-foreground",
              })}
            >
              <ArrowLeft aria-hidden="true" className="size-3" />
              Colecciones
            </AppBackLink>
            <PageHero
              surface="collection-detail-info"
              title={collection.name}
              icon={
                <EntityIcon
                  value={icon}
                  fallback={CustomCollection}
                  className="size-5"
                />
              }
              description={
                collection.description ??
                "Recursos guardados en esta colección privada."
              }
              action={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editDialog.openEdit(collection)}
                  >
                    <Pencil aria-hidden="true" />
                    Editar
                  </Button>
                  <Hint label="Eliminar colección">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Eliminar ${collection.name}`}
                      onClick={() => deleteDialog.open(collection)}
                    >
                      <Trash aria-hidden="true" />
                    </Button>
                  </Hint>
                </div>
              }
            />
          </div>
          {items.isError ? (
            <StateCard
              title="No se pudieron cargar los recursos"
              description="Inténtalo de nuevo dentro de unos instantes."
              tone="destructive"
              action={
                <Button variant="outline" onClick={() => items.refetch()}>
                  Reintentar
                </Button>
              }
            />
          ) : items.isPending ? (
            <StateCard spinner title="Cargando recursos..." />
          ) : (
            <SavedResourceList
              resources={items.data ?? []}
              emptyTitle="La colección está vacía"
              emptyDescription="Usa el botón Guardar de cualquier recurso para añadirlo aquí."
              action={(item) => (
                <Hint label="Quitar de esta colección">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    aria-label="Quitar de esta colección"
                    disabled={removeItem.isPending}
                    onClick={() =>
                      removeItem.mutate({
                        collectionId,
                        entityType: item.entityType,
                        entityId: item.entityId,
                      })
                    }
                  >
                    <Trash aria-hidden="true" />
                  </Button>
                </Hint>
              )}
            />
          )}
        </div>
      </PageShell>
      <CollectionFormDialog
        collection={editDialog.editing}
        icon={icon}
        {...editDialog.dialogProps}
      />
      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
