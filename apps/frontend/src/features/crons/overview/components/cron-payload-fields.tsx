import { useEffect, useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { FieldLabel } from "@/components/shared/form/field-label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type JsonSchemaProperty = {
  type?: string | string[]
  description?: string
  enum?: unknown[]
}

type ObjectJsonSchema = {
  type?: string
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export type CronPayload = Record<string, unknown>

function propertyType(prop: JsonSchemaProperty): string {
  if (Array.isArray(prop.type)) return prop.type[0] ?? "string"
  return prop.type ?? "string"
}

function isEditableSchema(schema: unknown): schema is ObjectJsonSchema {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "properties" in schema &&
    typeof (schema as ObjectJsonSchema).properties === "object"
  )
}

/**
 * Raw-JSON fallback for array/object payload properties. Keeps its own draft
 * text so an in-progress edit stays visible even while it fails to parse,
 * instead of silently reverting to the last valid value the way a fully
 * controlled textarea would.
 */
function JsonFallbackField({
  fieldId,
  value,
  required,
  onChange,
  onValidityChange,
}: {
  fieldId: string
  value: unknown
  required?: boolean
  onChange: (next: unknown) => void
  onValidityChange: (valid: boolean) => void
}) {
  const [draft, setDraft] = useState(() =>
    value === undefined ? "" : JSON.stringify(value)
  )
  const [invalid, setInvalid] = useState(false)
  const errorId = `${fieldId}-error`

  useEffect(() => {
    onValidityChange(!invalid)
  }, [invalid, onValidityChange])

  return (
    <div className="space-y-1.5">
      <textarea
        id={fieldId}
        rows={3}
        required={required}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className={cn(
          textVariants({ role: "data" }),
          "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 shadow-xs outline-none transition-[color,box-shadow]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40"
        )}
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          if (next.trim() === "") {
            setInvalid(false)
            onChange(undefined)
            return
          }
          try {
            onChange(JSON.parse(next))
            setInvalid(false)
          } catch {
            setInvalid(true)
          }
        }}
      />
      {invalid ? (
        <Text
          as="p"
          variant="compact"
          tone="destructive"
          className="leading-relaxed"
          id={errorId}
          role="alert"
        >
          JSON inválido: corrígelo antes de guardar.
        </Text>
      ) : null}
    </div>
  )
}

/**
 * Renders a form field per property of a handler's JSON Schema. Simple
 * scalar types (string, number, boolean, string enum) get a native control;
 * anything else (arrays, nested objects) falls back to a raw JSON textarea
 * so the payload can still be edited without a full schema-form library.
 */
export function CronPayloadFields({
  schema,
  value,
  onChange,
  onValidityChange,
}: {
  schema: Record<string, unknown> | null
  value: CronPayload
  onChange: (next: CronPayload) => void
  /** Fires whenever a JSON-fallback field's parse state changes, so the
   * caller can block submission while a payload field is malformed. */
  onValidityChange?: (valid: boolean) => void
}) {
  const editable = isEditableSchema(schema)
  const properties = editable ? Object.entries(schema.properties ?? {}) : []
  const propertyKeys = properties.map(([key]) => key).join("|")

  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set())

  // Switching handlers swaps the schema's properties out from under any
  // still-invalid field, so start that field's validity clean rather than
  // carrying a stale block forward.
  useEffect(() => {
    setInvalidFields(new Set())
  }, [propertyKeys])

  useEffect(() => {
    onValidityChange?.(invalidFields.size === 0)
  }, [invalidFields, onValidityChange])

  if (!editable || properties.length === 0) {
    return null
  }

  const required = new Set(schema.required ?? [])

  const setField = (key: string, fieldValue: unknown) => {
    onChange({ ...value, [key]: fieldValue })
  }

  const setFieldValidity = (key: string, valid: boolean) => {
    setInvalidFields((current) => {
      if (valid === !current.has(key)) return current
      const next = new Set(current)
      if (valid) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {properties.map(([key, prop]) => {
        const type = propertyType(prop)
        const fieldId = `cron-payload-${key}`
        const isRequired = required.has(key)
        const currentValue = value[key]

        return (
          <div key={key} className="space-y-2">
            <FieldLabel htmlFor={fieldId}>
              {key}
              {isRequired ? <span className="text-destructive"> *</span> : null}
            </FieldLabel>

            {type === "boolean" ? (
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id={fieldId}
                  checked={currentValue === true}
                  onCheckedChange={(checked) => setField(key, checked === true)}
                />
                {prop.description ? (
                  <Text variant="compact" tone="muted">
                    {prop.description}
                  </Text>
                ) : null}
              </div>
            ) : prop.enum && prop.enum.length > 0 ? (
              <Select
                items={prop.enum.map((option) => ({
                  value: String(option),
                  label: String(option),
                }))}
                value={typeof currentValue === "string" ? currentValue : ""}
                onValueChange={(next) => setField(key, next)}
              >
                <SelectTrigger id={fieldId} className="w-full">
                  <SelectValue placeholder="Selecciona un valor" />
                </SelectTrigger>
                <SelectContent>
                  {prop.enum.map((option) => (
                    <SelectItem key={String(option)} value={String(option)}>
                      {String(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : type === "number" || type === "integer" ? (
              <Input
                id={fieldId}
                type="number"
                required={isRequired}
                className="tabular-nums"
                value={typeof currentValue === "number" ? currentValue : ""}
                onChange={(e) =>
                  setField(
                    key,
                    e.target.value === "" ? undefined : Number(e.target.value)
                  )
                }
              />
            ) : type === "string" ? (
              <Input
                id={fieldId}
                required={isRequired}
                value={typeof currentValue === "string" ? currentValue : ""}
                onChange={(e) => setField(key, e.target.value)}
              />
            ) : (
              <JsonFallbackField
                fieldId={fieldId}
                value={currentValue}
                required={isRequired}
                onChange={(next) => setField(key, next)}
                onValidityChange={(valid) => setFieldValidity(key, valid)}
              />
            )}

            {prop.description && type !== "boolean" ? (
              <Text
                as="p"
                variant="compact"
                tone="muted"
                className="leading-relaxed"
              >
                {prop.description}
              </Text>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
