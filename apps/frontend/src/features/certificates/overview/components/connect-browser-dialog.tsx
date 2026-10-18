import { getIcon } from "@/lib/icon-registry"

const ShieldAlert = getIcon("security", "warning")
const Connected = getIcon("security", "verified")

import { useQueryClient } from "@tanstack/react-query"
import { type SyntheticEvent, useEffect, useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { CopyButton } from "@/components/shared/form/copy-button"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { SegmentedPicker } from "@/components/shared/form/segmented-picker"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { browserTokenLabels } from "@/features/certificates/overview/definitions/browser-token-labels"
import {
  browsersListKey,
  useConnectionStatus,
  useStartConnection,
} from "@/features/certificates/overview/hooks/use-browser-tokens"
import {
  detectInstallSystem,
  type InstallSystem,
  remainingLabel,
  type StartedConnection,
} from "@/features/certificates/overview/model/browser-tokens"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { getAppSurface } from "@/lib/app-surfaces"
import { cn } from "@/lib/utils"

interface ConnectValues {
  name: string
}

const fields: DialogFieldDescriptor<ConnectValues>[] = [
  {
    kind: "text",
    key: "name",
    label: browserTokenLabels.name,
    placeholder: browserTokenLabels.namePlaceholder,
    required: true,
    autoFocus: true,
    maxLength: 100,
  },
]

interface DialogStateProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function TwoFactorRequiredDialog({ open, onOpenChange }: DialogStateProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{browserTokenLabels.twoFactorTitle}</DialogTitle>
          <DialogDescription>
            {browserTokenLabels.twoFactorDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            render={<AppLink href={getAppSurface("profile").path} />}
            nativeButton={false}
          >
            {browserTokenLabels.twoFactorAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Re-renders every second while `active`, for the countdown. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

const SYSTEM_OPTIONS = [
  { value: "linux", label: browserTokenLabels.linux },
  { value: "windows", label: browserTokenLabels.windows },
] satisfies { value: InstallSystem; label: string }[]

function PendingBody({ connection }: { connection: StartedConnection }) {
  const now = useNow(true)
  const [system, setSystem] = useState<InstallSystem>(() =>
    detectInstallSystem(navigator.userAgent)
  )
  const command = connection.commands[system]
  return (
    <div className="space-y-4 px-6 py-5">
      <div className="max-w-56">
        <SegmentedPicker
          label={browserTokenLabels.system}
          options={SYSTEM_OPTIONS}
          value={system}
          onChange={setSystem}
          columns={2}
        />
      </div>
      <div className="flex items-start gap-2">
        <pre
          className={cn(
            textVariants({ role: "data" }),
            "min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-md border bg-muted/40 px-3 py-2.5 leading-relaxed"
          )}
        >
          {command}
        </pre>
        <CopyButton
          text={command}
          label={browserTokenLabels.copyCommand}
          copiedLabel="Copiado"
          size="icon"
          variant="outline"
          className="shrink-0"
        />
      </div>
      <Text
        as="p"
        variant="meta"
        tone="muted"
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
      >
        <span>
          {browserTokenLabels.code}{" "}
          <Text as="span" variant="data" tone="default">
            {connection.displayCode}
          </Text>
        </span>
        <span className="tabular-nums">
          {browserTokenLabels.expiresIn(
            remainingLabel(connection.expiresAt, now)
          )}
        </span>
      </Text>
      <Text
        as="p"
        variant="meta"
        tone="muted"
        className="flex items-center gap-2"
        role="status"
      >
        <Spinner className="size-3.5" />
        {browserTokenLabels.waiting}
      </Text>
      <Text
        as="div"
        variant="compact"
        tone="muted"
        className="flex items-start gap-2 border-t pt-4 leading-relaxed"
        role="note"
      >
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
        <p>{browserTokenLabels.requirements[system]}</p>
      </Text>
    </div>
  )
}

function ConnectionDialog({
  open,
  onOpenChange,
  name,
  connection,
  onRegenerate,
  isRegenerating,
}: DialogStateProps & {
  name: string
  connection: StartedConnection
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const queryClient = useQueryClient()
  const { data: status } = useConnectionStatus(connection.code)
  const state = status?.state ?? "pending"

  useEffect(() => {
    if (state !== "connected") return
    void queryClient.invalidateQueries({ queryKey: browsersListKey })
  }, [state, queryClient])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* One shrinkable column: the command never wraps, and an auto grid
          track would widen past the dialog to fit it. */}
      <DialogContent className="grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {state === "connected" ? (
          <>
            <DialogHeader className="gap-1.5 border-b px-6 py-5 text-left">
              <DialogTitle className="flex items-center gap-2">
                <Connected className="size-4 text-primary" />
                {browserTokenLabels.connectedTitle}
              </DialogTitle>
              <DialogDescription>
                {browserTokenLabels.connectedDescription(name)}
              </DialogDescription>
            </DialogHeader>
            <Text as="p" variant="body" className="px-6 py-5 leading-relaxed">
              {browserTokenLabels.usage}
            </Text>
          </>
        ) : null}
        {state === "expired" ? (
          <DialogHeader className="gap-1.5 border-b px-6 py-5 text-left">
            <DialogTitle>{browserTokenLabels.expiredTitle}</DialogTitle>
            <DialogDescription>
              {browserTokenLabels.expiredDescription}
            </DialogDescription>
          </DialogHeader>
        ) : null}
        {state === "pending" ? (
          <>
            <DialogHeader className="gap-1.5 border-b px-6 py-5 text-left">
              <DialogTitle>{browserTokenLabels.commandTitle}</DialogTitle>
              <DialogDescription
                className={cn(
                  textVariants({ role: "compact" }),
                  "leading-relaxed"
                )}
              >
                {browserTokenLabels.commandDescription}
              </DialogDescription>
            </DialogHeader>
            <PendingBody connection={connection} />
          </>
        ) : null}
        <DialogFooter className="border-t px-6 py-4">
          {state === "expired" ? (
            <Button
              type="button"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {browserTokenLabels.regenerate}
            </Button>
          ) : (
            <Button type="button" onClick={() => onOpenChange(false)}>
              {browserTokenLabels.close}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ConnectBrowserDialogProps extends DialogStateProps {
  /** The token's PIN is the TOTP code, so it needs two-factor on. */
  twoFactorEnabled: boolean
}

/**
 * "Conectar navegador": names the browser, then shows the one command that
 * installs the module with a one-time code and waits until it has run.
 */
export function ConnectBrowserDialog({
  open,
  onOpenChange,
  twoFactorEnabled,
}: ConnectBrowserDialogProps) {
  const start = useStartConnection()
  const form = useDialogForm(open, { name: "" })
  const [connection, setConnection] = useState<StartedConnection | null>(null)
  const [name, setName] = useState("")

  const handleOpenChange = (next: boolean) => {
    if (!next) setConnection(null)
    onOpenChange(next)
  }

  const begin = async (browserName: string) => {
    setConnection(await start.mutateAsync({ name: browserName }))
    setName(browserName)
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    await begin(form.trimmed().name)
  }

  if (!twoFactorEnabled) {
    return <TwoFactorRequiredDialog open={open} onOpenChange={onOpenChange} />
  }

  if (connection) {
    return (
      <ConnectionDialog
        key={connection.code}
        open={open}
        onOpenChange={handleOpenChange}
        name={name}
        connection={connection}
        onRegenerate={() => void begin(name)}
        isRegenerating={start.isPending}
      />
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={browserTokenLabels.connectTitle}
      description={browserTokenLabels.connectDescription}
      onSubmit={handleSubmit}
      isPending={start.isPending}
      submitDisabled={!form.values.name.trim()}
      submitLabel={browserTokenLabels.create}
      form={form}
      fields={fields}
    />
  )
}
