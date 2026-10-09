import type { ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { UseDialogFormReturn } from "@/hooks/use-dialog-form"

/** Every key of `TValues` whose value type extends `TValue` — used to keep a field kind bound only to compatible keys. */
type FieldKey<TValues, TValue> = {
  [K in keyof TValues]: TValues[K] extends TValue ? K : never
}[keyof TValues] &
  string

interface DialogFieldBase<TKey extends string> {
  key: TKey
  label: string
  hint?: ReactNode
  required?: boolean
  autoFocus?: boolean
}

export type DialogFieldDescriptor<TValues extends object> =
  | (DialogFieldBase<FieldKey<TValues, string>> & {
      kind: "text" | "email" | "password"
      placeholder?: string
      minLength?: number
      maxLength?: number
      autoComplete?: string
    })
  | (DialogFieldBase<FieldKey<TValues, string>> & {
      kind: "textarea"
      placeholder?: string
      rows?: number
    })
  | (DialogFieldBase<FieldKey<TValues, string>> & {
      kind: "select"
      placeholder?: string
      options: { value: string; label: string }[]
    })
  | (DialogFieldBase<FieldKey<TValues, boolean>> & {
      kind: "checkbox"
      description?: ReactNode
    })

/**
 * Renders one `DialogFieldDescriptor` bound to a `useDialogForm` instance —
 * value, change handler and field-level error all come from `form.field(key)`,
 * so a caller never wires `value`/`onChange`/`aria-invalid` by hand.
 */
// `form.field(key)`'s `onChange` is typed `(value: TValues[K]) => void` for
// the specific `K` a descriptor was authored against, but inside this
// generic renderer `descriptor.key`'s type is the *union* `FieldKey<TValues,
// TValue>` — TypeScript can't narrow `K` from a runtime string, so a plain
// `string`/`boolean` argument doesn't structurally match `TValues[K]` for
// every union member even though it's safe for whichever one is actually
// selected. Same class of escape hatch `resolveIconRef` uses for the same
// reason; the descriptor union itself is what keeps callers type-safe.
function asFieldValue<TValue>(value: unknown): TValue {
  return value as TValue
}

function DialogField<TValues extends object>({
  descriptor,
  form,
}: {
  descriptor: DialogFieldDescriptor<TValues>
  form: UseDialogFormReturn<TValues>
}) {
  const id = `dialog-field-${descriptor.key}`
  const errorId = `${id}-error`

  if (descriptor.kind === "checkbox") {
    const { value, onChange } = form.field(descriptor.key)
    return (
      <FormField label={descriptor.label} htmlFor={id} hint={descriptor.hint}>
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={value as boolean}
            onCheckedChange={(checked) =>
              onChange(
                asFieldValue<TValues[FieldKey<TValues, boolean>]>(
                  checked === true
                )
              )
            }
          />
          {descriptor.description ? (
            <Text as="label" htmlFor={id} variant="body">
              {descriptor.description}
            </Text>
          ) : null}
        </div>
      </FormField>
    )
  }

  const { value, error, onChange } = form.field(descriptor.key)
  const invalid = error ? true : undefined
  const describedBy = error ? errorId : undefined

  return (
    <FormField label={descriptor.label} htmlFor={id} hint={descriptor.hint}>
      {descriptor.kind === "textarea" ? (
        <Textarea
          id={id}
          value={value as string}
          onChange={(event) =>
            onChange(
              asFieldValue<TValues[FieldKey<TValues, string>]>(
                event.target.value
              )
            )
          }
          placeholder={descriptor.placeholder}
          required={descriptor.required}
          autoFocus={descriptor.autoFocus}
          rows={descriptor.rows}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      ) : descriptor.kind === "select" ? (
        <Select
          items={descriptor.options}
          value={value as string}
          onValueChange={(next) =>
            onChange(
              asFieldValue<TValues[FieldKey<TValues, string>]>(next ?? "")
            )
          }
        >
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder={descriptor.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {descriptor.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={descriptor.kind}
          value={value as string}
          onChange={(event) =>
            onChange(
              asFieldValue<TValues[FieldKey<TValues, string>]>(
                event.target.value
              )
            )
          }
          placeholder={descriptor.placeholder}
          required={descriptor.required}
          minLength={descriptor.minLength}
          maxLength={descriptor.maxLength}
          autoComplete={descriptor.autoComplete}
          autoFocus={descriptor.autoFocus}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}
      {error ? (
        <Text
          as="p"
          variant="compact"
          tone="destructive"
          id={errorId}
          role="alert"
        >
          {error}
        </Text>
      ) : null}
    </FormField>
  )
}

/** Renders a list of `DialogFieldDescriptor`s bound to one `useDialogForm` instance, in order. */
export function DialogFields<TValues extends object>({
  form,
  fields,
}: {
  form: UseDialogFormReturn<TValues>
  fields: DialogFieldDescriptor<TValues>[]
}) {
  return (
    <>
      {fields.map((descriptor) => (
        <DialogField key={descriptor.key} descriptor={descriptor} form={form} />
      ))}
    </>
  )
}
