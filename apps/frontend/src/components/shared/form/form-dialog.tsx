import { getIcon } from "@/lib/icon-registry"

const Loader2 = getIcon("status", "loading")

import type { ReactNode, SyntheticEvent } from "react"
import { textVariants } from "@/components/shared/brand/typography"
import {
  type DialogFieldDescriptor,
  DialogFields,
} from "@/components/shared/form/dialog-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UseDialogFormReturn } from "@/hooks/use-dialog-form"
import { cn } from "@/lib/utils"

/**
 * Shared dialog chrome for create/edit forms: title, description, `<form>`
 * body, and a cancel + submit footer with a pending spinner. Field state is
 * owned separately by `useDialogForm` — this component only owns the shell.
 *
 * Conventional fields can be declared via `form`+`fields` instead of
 * hand-authoring `FormField`/`Input` children: pass the `useDialogForm`
 * instance and a list of `DialogFieldDescriptor`s and they render (in order)
 * before `children`. `children` remains the escape hatch for a custom
 * section (a schedule builder, a permission matrix, an entity picker) — the
 * two can be mixed in the same dialog.
 *
 * Quiet-editorial chrome: `p-0`, header/footer hairlines, headline-role title.
 */
export function FormDialog<TValues extends object = never>({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isPending = false,
  submitLabel,
  submitDisabled = false,
  cancelLabel = "Cancelar",
  submitVariant,
  className,
  form,
  fields,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void | Promise<void>
  isPending?: boolean
  submitLabel: ReactNode
  submitDisabled?: boolean
  cancelLabel?: string
  submitVariant?: "destructive"
  className?: string
  form?: UseDialogFormReturn<TValues>
  fields?: DialogFieldDescriptor<TValues>[]
  children?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg",
          className
        )}
      >
        <DialogHeader className="gap-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription
              className={cn(
                textVariants({ role: "compact" }),
                "leading-relaxed"
              )}
            >
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {/* `min-w-0`: as a grid item the form would otherwise grow to its
            min-content width, so a long unbreakable value (a truncated file
            name) would widen the whole dialog past its max width. */}
        <form onSubmit={onSubmit} className="flex min-w-0 flex-col">
          <div className="space-y-4 px-6 py-5">
            {form && fields ? (
              <DialogFields form={form} fields={fields} />
            ) : null}
            {children}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant={submitVariant}
              disabled={isPending || submitDisabled}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
