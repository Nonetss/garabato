import { getIcon } from "@/lib/icon-registry"

const CustomCollection = getIcon("collections", "custom")
const Plus = getIcon("actions", "add")

import { HeroCount } from "@/components/shared/layout/page-hero"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CollectionCardGrid } from "@/features/collections/overview/components/collection-card"
import { CollectionFormDialog } from "@/features/collections/overview/components/collection-form-dialog"
import {
  useCollections,
  useDeleteCollection,
} from "@/features/collections/save"
import { collectionIconRef } from "@/features/collections/shared/model/icon"
import type { Collection } from "@/features/collections/shared/model/types"
import { useEntityIcons } from "@/features/entity-icons"
import { useEditDialog } from "@/hooks/use-edit-dialog"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"

export function CollectionsContent() {
  const collections = useCollections()
  const deleteCollection = useDeleteCollection()
  const editDialog = useEditDialog<Collection>()
  const deleteDialog = useTargetConfirmDialog<Collection>({
    title: "Eliminar colección",
    description: (collection) =>
      `Eliminar “${collection.name}” también quitará todos sus recursos guardados. Esta acción no se puede deshacer.`,
    confirmLabel: "Eliminar colección",
    onConfirm: (collection) =>
      deleteCollection.mutateAsync({ id: collection.id }),
  })
  const customCollections =
    collections.data?.filter((collection) => collection.kind === "custom") ?? []
  const icons = useEntityIcons(
    customCollections.map((collection) => collectionIconRef(collection.id))
  )
  const iconFor = (collection: Collection) =>
    icons.iconFor(collectionIconRef(collection.id))

  return (
    <>
      <ResourceOverview
        surface="collection-detail"
        heroMeta={
          <HeroCount
            segments={[
              { count: customCollections.length, label: "colecciones" },
            ]}
          />
        }
        heroAction={
          <Button type="button" onClick={editDialog.openCreate}>
            <Plus aria-hidden="true" />
            Nueva colección
          </Button>
        }
        query={collections}
        loading="Cargando colecciones..."
        error={{
          icon: <CustomCollection className="size-6" />,
          title: "No se pudieron cargar las colecciones",
          description: "Inténtalo de nuevo dentro de unos instantes.",
          action: (
            <Button variant="outline" onClick={() => collections.refetch()}>
              Reintentar
            </Button>
          ),
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <CustomCollection className="size-6" />,
          title: "Todavía no tienes colecciones personalizadas",
          description:
            "Crea una colección para empezar a organizar tus recursos guardados.",
          action: (
            <Button type="button" onClick={editDialog.openCreate}>
              <Plus aria-hidden="true" />
              Nueva colección
            </Button>
          ),
        }}
      >
        {() => (
          <CollectionCardGrid
            collections={customCollections}
            iconFor={iconFor}
            onEdit={editDialog.openEdit}
            onDelete={deleteDialog.open}
          />
        )}
      </ResourceOverview>

      <CollectionFormDialog
        collection={editDialog.editing}
        icon={editDialog.editing ? iconFor(editDialog.editing) : null}
        {...editDialog.dialogProps}
      />
      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
