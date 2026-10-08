import { getIcon } from "@/lib/icon-registry"

const CalendarClock = getIcon("scheduling", "schedule")

import { type SyntheticEvent, useEffect, useRef, useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { FieldLabel, FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CronPayloadFields } from "@/features/crons/overview/components/cron-payload-fields"
import { CronScheduleBuilder } from "@/features/crons/overview/components/cron-schedule-builder"
import { CronUserPicker } from "@/features/crons/overview/components/cron-user-picker"
import { useCronHandlers } from "@/features/crons/overview/hooks/use-cron-handlers"
import type { CronJob } from "@/features/crons/shared"
import {
  cronLabels,
  useCronCreate,
  useCronUpdate,
} from "@/features/crons/shared"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

interface CronFormDialogProps {
  job: CronJob | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type CronHandler = { key: string; tags: string[] }

function groupHandlersByTag<T extends CronHandler>(handlers: T[]) {
  const groups = new Map<string, T[]>()

  for (const handler of handlers) {
    const tag = handler.tags[0] ?? cronLabels.untaggedHandlers
    const existing = groups.get(tag)
    if (existing) {
      existing.push(handler)
    } else {
      groups.set(tag, [handler])
    }
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === cronLabels.untaggedHandlers) return 1
    if (b === cronLabels.untaggedHandlers) return -1
    return a.localeCompare(b, "es")
  })
}

export function CronFormDialog({
  job,
  open,
  onOpenChange,
}: CronFormDialogProps) {
  const { data: handlers = [] } = useCronHandlers()
  const { data: session } = authClient.useSession()
  const createCron = useCronCreate()
  const updateCron = useCronUpdate()
  const isEditing = !!job

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [cronExpression, setCronExpression] = useState("")
  const [handlerKey, setHandlerKey] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [payload, setPayload] = useState<Record<string, unknown>>({})
  const [payloadValid, setPayloadValid] = useState(true)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const cronExpressionInputRef = useRef<HTMLInputElement>(null)
  const restoreCronExpressionFocus = useRef(false)

  useEffect(() => {
    if (!open) return
    setName(job?.name ?? "")
    setDescription(job?.description ?? "")
    setCronExpression(job?.cronExpression ?? "0 9 * * *")
    setHandlerKey(job?.handlerKey ?? handlers[0]?.key ?? "")
    setEnabled(job?.enabled ?? true)
    setUserId(job?.userId ?? null)
    setPayload(job?.payload ?? {})
    setPayloadValid(true)
  }, [open, job, handlers])

  useEffect(() => {
    if (isEditing || !open || !session?.user.id) return
    setUserId((current) => current ?? session.user.id)
  }, [isEditing, open, session?.user.id])

  useEffect(() => {
    if (!restoreCronExpressionFocus.current || scheduleDialogOpen) return
    cronExpressionInputRef.current?.focus()
    restoreCronExpressionFocus.current = false
  }, [scheduleDialogOpen])

  const selectedHandler = handlers.find((h) => h.key === handlerKey)
  const isPending = createCron.isPending || updateCron.isPending
  const handlerGroups = groupHandlersByTag(handlers)

  const handleOpenChange = (next: boolean) => {
    if (isPending) return
    if (!next) setScheduleDialogOpen(false)
    onOpenChange(next)
  }

  const handleScheduleOpen = () => {
    restoreCronExpressionFocus.current = true
    setScheduleDialogOpen(true)
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payloadOrNull = Object.keys(payload).length > 0 ? payload : null

    if (isEditing && job) {
      await updateCron.mutateAsync({
        id: job.id,
        name,
        description: description || null,
        cronExpression,
        handlerKey,
        userId,
        payload: payloadOrNull,
      })
    } else {
      await createCron.mutateAsync({
        name,
        description: description || null,
        cronExpression,
        handlerKey,
        enabled,
        // Leaving it unset lets the backend default to the creator; only an
        // explicit pick overrides that.
        userId: userId ?? undefined,
        payload: payloadOrNull,
      })
    }
    handleOpenChange(false)
  }

  return (
    <>
      <FormDialog
        open={open && !scheduleDialogOpen}
        onOpenChange={handleOpenChange}
        title={isEditing ? cronLabels.edit : cronLabels.create}
        description={
          isEditing
            ? "Cambia la definición del cron."
            : "Define un job programado a partir de un handler cron-eligible."
        }
        onSubmit={handleSubmit}
        isPending={isPending}
        submitDisabled={!handlerKey || !payloadValid}
        submitLabel={isEditing ? "Guardar" : cronLabels.create}
        className="sm:max-w-4xl"
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <FieldLabel>Definición</FieldLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Nombre"
                  htmlFor="cron-name"
                  className="sm:col-span-2"
                >
                  <Input
                    id="cron-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </FormField>

                <FormField
                  label="Descripción"
                  htmlFor="cron-description"
                  className="sm:col-span-2"
                >
                  <Input
                    id="cron-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </FormField>

                <FormField
                  label="Expresión (UTC)"
                  htmlFor="cron-expression"
                  hint="Indica cuándo se ejecutará la tarea. Ejemplo: cada 5 minutos."
                >
                  <div className="space-y-2">
                    <Input
                      id="cron-expression"
                      required
                      ref={cronExpressionInputRef}
                      placeholder="*/5 * * * *"
                      className={textVariants({ role: "data" })}
                      value={cronExpression}
                      onChange={(event) =>
                        setCronExpression(event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleScheduleOpen}
                    >
                      <CalendarClock className="size-4" />
                      Asistente
                    </Button>
                  </div>
                </FormField>

                <FormField
                  label={cronLabels.handler}
                  htmlFor="cron-handler"
                  hint={
                    selectedHandler?.description ??
                    "Elige la acción que ejecutará esta tarea."
                  }
                >
                  <Select
                    items={handlerGroups.flatMap(([, groupHandlers]) =>
                      groupHandlers.map((handler) => ({
                        value: handler.key,
                        label: handler.key,
                      }))
                    )}
                    value={handlerKey}
                    onValueChange={(value) => {
                      if (value !== null) setHandlerKey(value)
                    }}
                  >
                    <SelectTrigger
                      id="cron-handler"
                      className={cn(textVariants({ role: "data" }), "w-full")}
                    >
                      <SelectValue placeholder={cronLabels.selectHandler} />
                    </SelectTrigger>
                    <SelectContent>
                      {handlerGroups.map(([tag, groupHandlers]) => (
                        <SelectGroup key={tag}>
                          <SelectLabel>{tag}</SelectLabel>
                          {groupHandlers.map((handler) => (
                            <SelectItem
                              key={handler.key}
                              value={handler.key}
                              className={textVariants({ role: "data" })}
                            >
                              {handler.key}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            <div className="border-t pt-6" />

            <div className="space-y-4">
              <FieldLabel htmlFor="cron-runs-as-search">Identidad</FieldLabel>
              <CronUserPicker
                userId={userId}
                onChange={setUserId}
                defaultsToCallerHint={!isEditing}
              />

              {!isEditing ? (
                <div className="flex items-center gap-2.5 pt-1">
                  <Checkbox
                    id="cron-enabled"
                    checked={enabled}
                    onCheckedChange={(checked) => setEnabled(checked === true)}
                  />
                  <Text
                    as="label"
                    htmlFor="cron-enabled"
                    variant="body"
                    tone="muted"
                  >
                    Habilitado al crear
                  </Text>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <FieldLabel>{cronLabels.payload}</FieldLabel>
            <Text
              as="p"
              variant="compact"
              tone="muted"
              className="-mt-2 leading-relaxed"
            >
              {selectedHandler?.inputSchema
                ? cronLabels.payloadHint
                : "Selecciona una acción para ver sus parámetros."}
            </Text>
            <CronPayloadFields
              schema={selectedHandler?.inputSchema ?? null}
              value={payload}
              onChange={setPayload}
              onValidityChange={setPayloadValid}
            />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={scheduleDialogOpen}
        onOpenChange={(next) => {
          if (isPending) return
          if (!next) {
            setScheduleDialogOpen(false)
            cronExpressionInputRef.current?.focus()
            restoreCronExpressionFocus.current = false
          } else {
            setScheduleDialogOpen(true)
          }
        }}
        title="Programar visualmente"
        description="Elige una frecuencia y guardaremos la expresión cron equivalente en UTC."
        onSubmit={(e) => {
          e.preventDefault()
          setScheduleDialogOpen(false)
          cronExpressionInputRef.current?.focus()
          restoreCronExpressionFocus.current = false
        }}
        submitLabel="Usar esta programación"
        className="sm:max-w-xl"
      >
        <CronScheduleBuilder
          expression={cronExpression}
          onChange={setCronExpression}
        />
      </FormDialog>
    </>
  )
}
