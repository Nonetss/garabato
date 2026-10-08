import { type SyntheticEvent, useEffect, useState } from "react"

import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateCollection,
  useUpdateCollection,
} from "@/features/collections/save"
import {
  COLLECTION_ICON_CATEGORIES,
  collectionIconRef,
} from "@/features/collections/shared/model/icon"
import type { Collection } from "@/features/collections/shared/model/types"
import {
  type EntityIconValue,
  IconPicker,
  useClearEntityIcon,
  useSetEntityIcon,
} from "@/features/entity-icons"
import { getIcon } from "@/lib/icon-registry"
import { notifyError } from "@/lib/toast"

const CustomCollection = getIcon("collections", "custom")

interface CollectionFormDialogProps {
  collection: Collection | null
  /** The collection's current icon when editing. */
  icon?: EntityIconValue | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function sameIcon(a: EntityIconValue | null, b: EntityIconValue | null) {
  return a?.icon === b?.icon && a?.color === b?.color
}

export function CollectionFormDialog({
  collection,
  icon: currentIcon = null,
  open,
  onOpenChange,
}: CollectionFormDialogProps) {
  const createCollection = useCreateCollection()
  const updateCollection = useUpdateCollection()
  const setIcon = useSetEntityIcon()
  const clearIcon = useClearEntityIcon()
  const isEditing = collection !== null
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIconValue] = useState<EntityIconValue | null>(null)
  const isPending =
    createCollection.isPending ||
    updateCollection.isPending ||
    setIcon.isPending ||
    clearIcon.isPending

  useEffect(() => {
    if (!open) return
    setName(collection?.name ?? "")
    setDescription(collection?.description ?? "")
    setIconValue(collection ? currentIcon : null)
  }, [collection, currentIcon, open])

  const saveIcon = async (collectionId: string) => {
    const previous = collection ? currentIcon : null
    if (sameIcon(icon, previous)) return
    const ref = collectionIconRef(collectionId)
    try {
      if (icon) await setIcon.mutateAsync({ ...ref, ...icon })
      else await clearIcon.mutateAsync(ref)
    } catch {
      // The collection itself is saved; the icon can be retried by editing.
      notifyError("No se pudo guardar el icono de la colección")
    }
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedDescription = description.trim() || null
    if (collection) {
      if (
        name !== collection.name ||
        trimmedDescription !== collection.description
      ) {
        await updateCollection.mutateAsync({
          id: collection.id,
          name,
          description: trimmedDescription,
        })
      }
      await saveIcon(collection.id)
    } else {
      const created = await createCollection.mutateAsync({
        name,
        description: trimmedDescription,
      })
      await saveIcon(created.id)
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar colección" : "Nueva colección"}
      description={
        isEditing
          ? "Cambia el nombre, la descripción o el icono de esta lista."
          : "Crea una lista privada para organizar los recursos guardados."
      }
      onSubmit={handleSubmit}
      isPending={isPending}
      submitLabel={isEditing ? "Guardar cambios" : "Crear colección"}
    >
      <FormField label="Nombre" htmlFor="collection-name">
        <div className="flex items-center gap-2">
          <IconPicker
            id="collection-icon"
            label="Icono de la colección"
            variant="dialog"
            value={icon}
            onChange={setIconValue}
            categories={COLLECTION_ICON_CATEGORIES}
            allowColor={false}
            fallback={CustomCollection}
            disabled={isPending}
          />
          <Input
            id="collection-name"
            required
            minLength={1}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Por ejemplo, Lecturas pendientes"
          />
        </div>
      </FormField>
      <FormField
        label="Descripción"
        htmlFor="collection-description"
        hint="Opcional. Aparece bajo el nombre en la página de la colección."
      >
        <Textarea
          id="collection-description"
          maxLength={500}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Por ejemplo, Artículos que quiero leer este mes"
        />
      </FormField>
    </FormDialog>
  )
}
