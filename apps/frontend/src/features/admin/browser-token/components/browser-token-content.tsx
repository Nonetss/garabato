import { getIcon } from "@/lib/icon-registry"

const TokenIcon = getIcon("security", "restricted")

import { type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  useBrowserTokenSettings,
  useUpdateBrowserTokenSettings,
} from "@/features/admin/browser-token/hooks/use-browser-token-settings"
import {
  type BrowserTokenSettings,
  type Confirmation,
  confirmationFor,
  connectedBrowsers,
  isModuleVersion,
  type SwitchValues,
} from "@/features/admin/browser-token/model/settings"
import { formatDateTime } from "@/lib/format"

function SwitchRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <li className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <Label htmlFor={id}>
          <Text as="span" variant="title">
            {title}
          </Text>
        </Label>
        <Text as="p" variant="meta" tone="muted" className="mt-1">
          {description}
        </Text>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="mt-1 shrink-0"
      />
    </li>
  )
}

// Browsers connected before modules reported a platform.
function platformLabel(platform: string) {
  if (platform === "unknown") return "plataforma desconocida"
  return platform
}

function lastChange(settings: BrowserTokenSettings) {
  if (!settings.updatedAt) return "Sin cambios: valores por defecto"
  const when = formatDateTime(settings.updatedAt, { includeYear: true })
  if (!settings.updatedBy) return `Último cambio el ${when}`
  return `Último cambio el ${when} por ${settings.updatedBy.name}`
}

function SettingsBody({ settings }: { settings: BrowserTokenSettings }) {
  const update = useUpdateBrowserTokenSettings()
  const [version, setVersion] = useState(settings.minModuleVersion ?? "")
  const [pending, setPending] = useState<{
    next: SwitchValues
    confirmation: Confirmation
  } | null>(null)

  const current: SwitchValues = {
    tokenEnabled: settings.tokenEnabled,
    installsEnabled: settings.installsEnabled,
    minModuleVersion: settings.minModuleVersion,
  }

  const request = (next: SwitchValues) => {
    const confirmation = confirmationFor(current, next, settings.browsers)
    if (confirmation) {
      setPending({ next, confirmation })
      return
    }
    update.mutate(next)
  }

  const trimmedVersion = version.trim()
  const versionValid = trimmedVersion === "" || isModuleVersion(trimmedVersion)
  const submitVersion = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!versionValid) return
    const minModuleVersion = trimmedVersion === "" ? null : trimmedVersion
    request({ ...current, minModuleVersion })
  }

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <SectionHeading title="Interruptores" />
        <ul className="divide-y border-y">
          <SwitchRow
            id="browser-token-enabled"
            title="Token del navegador"
            description="Apagado, ningún navegador puede entrar con certificado ni conectarse."
            checked={settings.tokenEnabled}
            disabled={update.isPending}
            onChange={(tokenEnabled) => request({ ...current, tokenEnabled })}
          />
          <SwitchRow
            id="browser-token-installs"
            title="Instalaciones"
            description="Apagadas, nadie puede conectar navegadores nuevos; los conectados siguen funcionando."
            checked={settings.installsEnabled}
            disabled={update.isPending || !settings.tokenEnabled}
            onChange={(installsEnabled) =>
              request({ ...current, installsEnabled })
            }
          />
          <li className="py-4">
            <form
              onSubmit={submitVersion}
              className="flex flex-wrap items-end justify-between gap-4"
            >
              <div className="min-w-0">
                <Label htmlFor="browser-token-min-version">
                  <Text as="span" variant="title">
                    Versión mínima del módulo
                  </Text>
                </Label>
                <Text as="p" variant="meta" tone="muted" className="mt-1">
                  Los módulos anteriores dejan de funcionar hasta que se vuelva
                  a conectar el navegador. Vacío, sin mínimo. Los instaladores
                  sirven la {settings.servedVersion}.
                </Text>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="browser-token-min-version"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  placeholder={settings.servedVersion}
                  aria-invalid={!versionValid}
                  className="w-28 font-mono"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={update.isPending || !versionValid}
                >
                  Aplicar
                </Button>
              </div>
            </form>
          </li>
        </ul>
        <Text as="p" variant="meta" tone="muted">
          {lastChange(settings)}
        </Text>
      </section>

      <section className="space-y-2">
        <SectionHeading
          title="Navegadores conectados por versión"
          count={connectedBrowsers(settings.browsers)}
        />
        {settings.browsers.length === 0 ? (
          <Text as="p" variant="meta" tone="muted">
            Ningún usuario ha conectado todavía un navegador.
          </Text>
        ) : (
          <ul className="divide-y border-y">
            {settings.browsers.map((group) => (
              <li
                key={`${group.version} ${group.platform}`}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Text as="span" variant="data" tone="default">
                    {group.version}
                  </Text>
                  <Text as="span" variant="meta" tone="muted">
                    {platformLabel(group.platform)}
                  </Text>
                  {group.outdated ? (
                    <StatusTag dotTone="destructive">Desactualizado</StatusTag>
                  ) : null}
                </div>
                <Text as="span" variant="data" tone="muted">
                  {group.count}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title={pending?.confirmation.title ?? ""}
        description={pending?.confirmation.description}
        confirmLabel={pending?.confirmation.confirmLabel}
        variant="destructive"
        onConfirm={async () => {
          if (!pending) return true
          await update.mutateAsync(pending.next)
          return true
        }}
      />
    </div>
  )
}

export function BrowserTokenContent() {
  const { data, isPending, isError, refetch } = useBrowserTokenSettings()

  return (
    <ResourceOverview
      maxWidth="4xl"
      surface="admin-browser-token"
      heroMeta={
        data ? (
          <HeroCount
            segments={[
              { count: connectedBrowsers(data.browsers), label: "navegadores" },
            ]}
          />
        ) : null
      }
      query={{ data, isPending, isError, refetch }}
      loading="Cargando los ajustes del token…"
      error={{
        icon: <TokenIcon className="size-6" />,
        title: "No se pudieron cargar los ajustes del token",
        description:
          "Comprueba tu conexión y tus permisos de administración; después, vuelve a intentarlo.",
      }}
    >
      {(settings) => <SettingsBody settings={settings} />}
    </ResourceOverview>
  )
}
