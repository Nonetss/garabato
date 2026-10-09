import { getIcon } from "@/lib/icon-registry"

const FolderIcon = getIcon("entities", "folder")

import { type SyntheticEvent, useMemo, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Input } from "@/components/ui/input"
import {
  buildFolderIndex,
  type DocumentFolder,
  documentLabels,
  folderIconRef,
  folderPathLabel,
  useDocumentFolderCreate,
  useDocumentFolderRename,
  useDocumentFolders,
} from "@/features/documents/shared"
import {
  EntityIconPicker,
  type EntityIconValue,
  IconPicker,
  useSetEntityIcon,
} from "@/features/entity-icons"
import { useOnOpen } from "@/hooks/use-on-open"
import { notifyError } from "@/lib/toast"

const NAME_ID = "document-folder-name"
const ICON_ID = "document-folder-icon"

/** Create a folder inside `parentId`, or edit `folder`. */
export type FolderDialogMode =
  | { kind: "create"; parentId: string | null }
  | { kind: "rename"; folder: DocumentFolder }

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Ha ocurrido un error inesperado"
}

/**
 * Names a new folder (with an optional icon, saved once the folder exists)
 * or edits one, whose icon is then saved in place like any entity icon.
 */
export function FolderDialog({
  mode,
  open,
  onOpenChange,
}: {
  mode: FolderDialogMode | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: folders = [] } = useDocumentFolders()
  const index = useMemo(() => buildFolderIndex(folders), [folders])
  const create = useDocumentFolderCreate()
  const rename = useDocumentFolderRename()
  const setIcon = useSetEntityIcon()
  const [name, setName] = useState("")
  const [icon, setIconValue] = useState<EntityIconValue | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useOnOpen(open, () => {
    const initialName = mode?.kind === "rename" ? mode.folder.name : ""
    setName(initialName)
    setIconValue(null)
    setSubmitError(null)
  })

  const editing = mode?.kind === "rename"
  const isPending = create.isPending || rename.isPending || setIcon.isPending

  const description = () => {
    if (mode?.kind !== "create") return undefined
    return documentLabels.createIn(folderPathLabel(index, mode.parentId))
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mode) return
    const trimmed = name.trim()
    if (trimmed === "") return
    try {
      if (mode.kind === "rename") {
        if (trimmed !== mode.folder.name) {
          await rename.mutateAsync({ id: mode.folder.id, name: trimmed })
        }
      } else {
        const folder = await create.mutateAsync({
          name: trimmed,
          ...(mode.parentId !== null && { parentId: mode.parentId }),
        })
        if (icon) {
          // The folder exists already: a failed icon is only reported.
          await setIcon
            .mutateAsync({ ...folderIconRef(folder.id), ...icon })
            .catch(() => notifyError("No se pudo guardar el icono"))
        }
      }
    } catch (error) {
      setSubmitError(errorMessage(error))
      return
    }
    onOpenChange(false)
  }

  const iconField = () => {
    if (mode?.kind === "rename") {
      return (
        <EntityIconPicker
          id={ICON_ID}
          entity={folderIconRef(mode.folder.id)}
          fallback={FolderIcon}
          defaultColor="neutral"
          label={documentLabels.folderIcon}
          variant="dialog"
        />
      )
    }
    return (
      <IconPicker
        id={ICON_ID}
        value={icon}
        onChange={setIconValue}
        fallback={FolderIcon}
        defaultColor="neutral"
        label={documentLabels.folderIcon}
        variant="dialog"
      />
    )
  }

  const title = editing
    ? documentLabels.editFolderTitle
    : documentLabels.newFolder
  const submitLabel = editing ? documentLabels.save : documentLabels.create
  // Editing saves the icon on pick, unlike the name: say so under the row.
  const nameHint = editing
    ? `${documentLabels.folderNameHint} ${documentLabels.folderIconSavedHint}`
    : documentLabels.folderNameHint

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description()}
      onSubmit={handleSubmit}
      isPending={isPending}
      submitDisabled={name.trim() === ""}
      submitLabel={submitLabel}
    >
      <FormField
        label={documentLabels.folderName}
        htmlFor={NAME_ID}
        hint={nameHint}
      >
        <div className="flex items-center gap-2">
          {iconField()}
          <Input
            id={NAME_ID}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setSubmitError(null)
            }}
            maxLength={100}
            aria-invalid={submitError !== null}
            className="min-w-0 flex-1"
            required
            autoFocus
          />
        </div>
      </FormField>
      {submitError ? (
        <Text as="p" variant="meta" tone="destructive" role="alert">
          {submitError}
        </Text>
      ) : null}
    </FormDialog>
  )
}
