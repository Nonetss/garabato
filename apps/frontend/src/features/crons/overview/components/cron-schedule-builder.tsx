import { useEffect, useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { FieldLabel } from "@/components/shared/form/field-label"
import { NumberStepper } from "@/components/shared/form/number-stepper"
import { SegmentedPicker } from "@/components/shared/form/segmented-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ScheduleMode =
  | "minutes"
  | "hours"
  | "daily"
  | "weekly"
  | "monthly"
  | "custom"

const weekdays = [
  { value: "1", label: "L", title: "Lunes" },
  { value: "2", label: "M", title: "Martes" },
  { value: "3", label: "X", title: "Miércoles" },
  { value: "4", label: "J", title: "Jueves" },
  { value: "5", label: "V", title: "Viernes" },
  { value: "6", label: "S", title: "Sábado" },
  { value: "0", label: "D", title: "Domingo" },
] as const

const daysOfMonth = Array.from({ length: 31 }, (_, index) => {
  const day = String(index + 1)
  return { value: day, label: day, title: `Día ${day}` }
})

function toNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function scheduleMode(expression: string): ScheduleMode {
  if (/^\*\/\d+ \* \* \* \*$/.test(expression)) return "minutes"
  if (/^0 \*\/\d+ \* \* \*$/.test(expression)) return "hours"
  if (/^\d+ \d+ \* \* \*$/.test(expression)) return "daily"
  if (/^\d+ \d+ \* \* [0-6]$/.test(expression)) return "weekly"
  if (/^\d+ \d+ (?:[1-9]|[12]\d|3[01]) \* \*$/.test(expression)) {
    return "monthly"
  }
  return "custom"
}

function defaultExpression(mode: ScheduleMode) {
  switch (mode) {
    case "minutes":
      return "*/15 * * * *"
    case "hours":
      return "0 */2 * * *"
    case "weekly":
      return "0 9 * * 1"
    case "monthly":
      return "0 9 1 * *"
    case "custom":
      return "0 9 * * 1-5"
    default:
      return "0 9 * * *"
  }
}

export function CronScheduleBuilder({
  expression,
  onChange,
}: {
  expression: string
  onChange: (expression: string) => void
}) {
  const [mode, setMode] = useState<ScheduleMode>(() => scheduleMode(expression))

  useEffect(() => {
    setMode(scheduleMode(expression))
  }, [expression])

  const [minute = "0", hour = "9", dayOfMonth = "1", , dayOfWeek = "1"] =
    expression.split(" ")
  const every =
    mode === "minutes"
      ? (expression.match(/^\*\/(\d+)/)?.[1] ?? "15")
      : (expression.match(/^0 \*\/(\d+)/)?.[1] ?? "2")

  const updateTime = (nextMinute: string, nextHour: string) => {
    switch (mode) {
      case "daily":
        onChange(`${nextMinute} ${nextHour} * * *`)
        break
      case "weekly":
        onChange(`${nextMinute} ${nextHour} * * ${dayOfWeek}`)
        break
      case "monthly":
        onChange(`${nextMinute} ${nextHour} ${dayOfMonth} * *`)
        break
    }
  }

  return (
    <div className="@container space-y-4 border-y py-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <FieldLabel>Programación</FieldLabel>
          <Text as="p" variant="compact" tone="muted" className="mt-1">
            Define cuándo debe ejecutarse el job. Todas las horas son UTC.
          </Text>
        </div>
        <Text as="code" variant="data">
          {expression}
        </Text>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <div className="grid gap-1.5">
          <FieldLabel>Frecuencia</FieldLabel>
          <Select
            items={[
              { value: "minutes", label: "Cada pocos minutos" },
              { value: "hours", label: "Cada pocas horas" },
              { value: "daily", label: "Cada día" },
              { value: "weekly", label: "Cada semana" },
              { value: "monthly", label: "Cada mes" },
              { value: "custom", label: "Avanzado (cron)" },
            ]}
            value={mode}
            onValueChange={(value) => {
              const nextMode = value as ScheduleMode
              setMode(nextMode)
              onChange(defaultExpression(nextMode))
            }}
          >
            <SelectTrigger aria-label="Frecuencia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Cada pocos minutos</SelectItem>
              <SelectItem value="hours">Cada pocas horas</SelectItem>
              <SelectItem value="daily">Cada día</SelectItem>
              <SelectItem value="weekly">Cada semana</SelectItem>
              <SelectItem value="monthly">Cada mes</SelectItem>
              <SelectItem value="custom">Avanzado (cron)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "minutes" || mode === "hours" ? (
          <div className="grid gap-1.5">
            <FieldLabel>
              Cada cuántos {mode === "minutes" ? "minutos" : "horas"}
            </FieldLabel>
            <NumberStepper
              label="Intervalo"
              min={1}
              max={mode === "minutes" ? 59 : 23}
              value={toNumber(every, mode === "minutes" ? 15 : 2)}
              onChange={(value) =>
                onChange(
                  mode === "minutes"
                    ? `*/${value} * * * *`
                    : `0 */${value} * * *`
                )
              }
            />
          </div>
        ) : null}

        {mode === "daily" || mode === "weekly" || mode === "monthly" ? (
          <>
            <div className="grid gap-1.5">
              <FieldLabel>Hora</FieldLabel>
              <NumberStepper
                label="Hora"
                min={0}
                max={23}
                value={toNumber(hour, 9)}
                onChange={(value) => updateTime(minute, String(value))}
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel>Minuto</FieldLabel>
              <NumberStepper
                label="Minuto"
                min={0}
                max={59}
                value={toNumber(minute, 0)}
                onChange={(value) => updateTime(String(value), hour)}
              />
            </div>
          </>
        ) : null}

        {mode === "weekly" ? (
          <div className="grid gap-1.5 @md:col-span-2">
            <FieldLabel>Día de la semana</FieldLabel>
            <SegmentedPicker
              label="Día de la semana"
              columns={7}
              options={weekdays}
              value={dayOfWeek}
              onChange={(value) => onChange(`${minute} ${hour} * * ${value}`)}
            />
          </div>
        ) : null}

        {mode === "monthly" ? (
          <div className="grid gap-1.5 @md:col-span-2">
            <FieldLabel>Día del mes</FieldLabel>
            <SegmentedPicker
              label="Día del mes"
              columns={7}
              mono
              options={daysOfMonth}
              value={dayOfMonth}
              onChange={(value) => onChange(`${minute} ${hour} ${value} * *`)}
            />
          </div>
        ) : null}

        {mode === "custom" ? (
          <div className="grid gap-1.5 @md:col-span-2">
            <FieldLabel>Expresión cron (UTC)</FieldLabel>
            <Input
              aria-label="Expresión cron (UTC)"
              required
              placeholder="*/5 * * * *"
              className={textVariants({ role: "data" })}
              value={expression}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
