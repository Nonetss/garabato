import { getIcon } from "@/lib/icon-registry"

const EditIcon = getIcon("actions", "edit")
const DeleteIcon = getIcon("actions", "delete")

import { useState } from "react"
import { RowActionsMenu } from "@/components/shared/data-display/row-actions-menu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { BackupCodesDialog } from "@/features/profile/overview/components/backup-codes-dialog"
import { TwoFactorDisableDialog } from "@/features/profile/overview/components/two-factor-disable-dialog"
import { TwoFactorEnableDialog } from "@/features/profile/overview/components/two-factor-enable-dialog"

type OpenDialog = "enable" | "disable" | "backup-codes" | null

/**
 * The profile's two-factor controls: "Activar" while it is off, a menu with
 * new backup codes and "Desactivar" while it is on. Owns their dialogs.
 */
export function TwoFactorActions({ enabled }: { enabled: boolean }) {
  const [dialog, setDialog] = useState<OpenDialog>(null)

  const onOpenChange = (open: boolean) => {
    if (!open) setDialog(null)
  }

  return (
    <>
      {enabled ? (
        <RowActionsMenu label="Acciones de la verificación en dos pasos">
          <DropdownMenuItem onClick={() => setDialog("backup-codes")}>
            <EditIcon className="size-4" />
            Nuevos códigos de respaldo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialog("disable")}
          >
            <DeleteIcon className="size-4" />
            Desactivar
          </DropdownMenuItem>
        </RowActionsMenu>
      ) : (
        <Button variant="outline" size="xs" onClick={() => setDialog("enable")}>
          Activar
        </Button>
      )}

      <TwoFactorEnableDialog
        open={dialog === "enable"}
        onOpenChange={onOpenChange}
      />
      <TwoFactorDisableDialog
        open={dialog === "disable"}
        onOpenChange={onOpenChange}
      />
      <BackupCodesDialog
        open={dialog === "backup-codes"}
        onOpenChange={onOpenChange}
      />
    </>
  )
}
