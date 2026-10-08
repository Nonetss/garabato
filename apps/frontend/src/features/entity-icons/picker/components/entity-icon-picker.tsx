import {
  IconPicker,
  type IconPickerProps,
} from "@/features/entity-icons/picker/components/icon-picker"
import {
  useClearEntityIcon,
  useSetEntityIcon,
} from "@/features/entity-icons/picker/hooks/use-entity-icon-mutations"
import { useEntityIcons } from "@/features/entity-icons/picker/hooks/use-entity-icons"
import type {
  EntityIconRef,
  EntityIconValue,
} from "@/features/entity-icons/picker/model/types"
import { notifyError } from "@/lib/toast"

interface EntityIconPickerProps
  extends Omit<IconPickerProps, "value" | "onChange"> {
  entity: EntityIconRef
}

/**
 * `IconPicker` bound to an entity: loads its icon and saves every change,
 * the way `CommentsButton` owns an entity's comments.
 */
export function EntityIconPicker({
  entity,
  ...pickerProps
}: EntityIconPickerProps) {
  const { iconFor, isPending } = useEntityIcons([entity])
  const setIcon = useSetEntityIcon()
  const clearIcon = useClearEntityIcon()

  // Show the choice immediately while it is being saved.
  const pendingValue: EntityIconValue | null | undefined = setIcon.isPending
    ? { icon: setIcon.variables.icon, color: setIcon.variables.color }
    : clearIcon.isPending
      ? null
      : undefined
  const value = pendingValue === undefined ? iconFor(entity) : pendingValue

  const handleChange = (next: EntityIconValue | null) => {
    const onError = () => notifyError("No se pudo guardar el icono")
    if (next) setIcon.mutate({ ...entity, ...next }, { onError })
    else clearIcon.mutate(entity, { onError })
  }

  return (
    <IconPicker
      {...pickerProps}
      value={value}
      onChange={handleChange}
      disabled={pickerProps.disabled || isPending}
    />
  )
}
