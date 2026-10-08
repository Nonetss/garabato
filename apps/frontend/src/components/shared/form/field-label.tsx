import type { ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { cn } from "@/lib/utils"

/** Micro-caps label used by quiet-editorial forms and fact rows. */
export function FieldLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Text
      as="label"
      htmlFor={htmlFor}
      variant="label"
      tone="muted"
      className={cn("block", className)}
    >
      {children}
    </Text>
  )
}

/** Form field: micro-caps label + control + optional hint. */
export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {hint ? (
        <Text as="p" variant="meta" tone="muted">
          {hint}
        </Text>
      ) : null}
    </div>
  )
}
