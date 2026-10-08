import { getIcon } from "@/lib/icon-registry"

const ShieldAlert = getIcon("security", "warning")

import { Text, textVariants } from "@/components/shared/brand/typography"
import { CopyButton } from "@/components/shared/form/copy-button"
import { FormField } from "@/components/shared/form/field-label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type ApiKeyCreatedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fullKey: string | null
}

export function ApiKeyCreatedDialog({
  open,
  onOpenChange,
  fullKey,
}: ApiKeyCreatedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-6 py-5 text-left">
          <DialogTitle className="tracking-tight">API key creada</DialogTitle>
          <DialogDescription
            className={cn(textVariants({ role: "compact" }), "leading-relaxed")}
          >
            Copia la clave ahora, no podrás volver a verla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {fullKey ? (
            <FormField label="Clave" htmlFor="api-key-value">
              <div className="flex items-stretch gap-2">
                <Input
                  id="api-key-value"
                  readOnly
                  value={fullKey}
                  className={cn(
                    textVariants({ role: "data" }),
                    "h-auto min-w-0 flex-1 select-all break-all py-2.5 leading-relaxed"
                  )}
                />
                <CopyButton
                  text={fullKey}
                  label="Copiar clave"
                  copiedLabel="Copiada"
                  showSuccessToast
                  onError="No se pudo copiar la clave"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                />
              </div>
            </FormField>
          ) : null}

          <Text
            as="div"
            variant="compact"
            tone="muted"
            className="flex items-start gap-2 border-t pt-4 leading-relaxed"
            role="note"
          >
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Por seguridad, esta clave no se volverá a mostrar. Guárdala en un
              lugar seguro.
            </p>
          </Text>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
