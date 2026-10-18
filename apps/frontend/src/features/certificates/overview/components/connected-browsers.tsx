import { getIcon } from "@/lib/icon-registry"

const BrowserIcon = getIcon("entities", "browser")
const DisconnectIcon = getIcon("actions", "disconnect")

import { Text } from "@/components/shared/brand/typography"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import { IconButton } from "@/components/shared/form/icon-button"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { browserTokenLabels } from "@/features/certificates/overview/definitions/browser-token-labels"
import {
  useConnectedBrowsers,
  useDisconnectBrowser,
  useTokenSwitches,
} from "@/features/certificates/overview/hooks/use-browser-tokens"
import {
  type ConnectedBrowser,
  platformLabel,
} from "@/features/certificates/overview/model/browser-tokens"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { formatDate, formatRelativeTime, joinFacts } from "@/lib/format"

function lastUseLabel(browser: ConnectedBrowser) {
  if (browser.lastUsedAt === null) return browserTokenLabels.neverUsed
  return browserTokenLabels.lastUsed(formatRelativeTime(browser.lastUsedAt))
}

function expiryLabel(browser: ConnectedBrowser) {
  if (browser.expiresAt === null) return null
  return browserTokenLabels.expires(formatDate(browser.expiresAt))
}

/** Platform and module version, as the browser last reported them. */
function moduleFacts(browser: ConnectedBrowser) {
  const facts = [`v${browser.moduleVersion}`]
  const platform = platformLabel(browser.platform)
  if (platform) facts.unshift(platform)
  return joinFacts(facts)
}

function BrowserCard({
  browser,
  onDisconnect,
}: {
  browser: ConnectedBrowser
  onDisconnect: (browser: ConnectedBrowser) => void
}) {
  const expiry = expiryLabel(browser)

  return (
    <li>
      <article className="flex h-full flex-col rounded-lg bg-background shadow-sheet">
        <header className="flex items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <BrowserIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <Text as="h3" variant="title" className="truncate">
              {browser.name}
            </Text>
            <Text as="p" variant="data" tone="muted" className="truncate">
              {moduleFacts(browser)}
            </Text>
          </div>
          <IconButton
            label={`${browserTokenLabels.disconnect} ${browser.name}`}
            icon={DisconnectIcon}
            variant="ghost"
            size="icon-sm"
            onClick={() => onDisconnect(browser)}
            className="-mt-1 -mr-2 shrink-0 text-muted-foreground"
          />
        </header>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t px-4 py-2.5">
          <Text variant="compact" tone="muted">
            {lastUseLabel(browser)}
          </Text>
          {browser.outdated ? (
            <StatusTag
              dotTone="destructive"
              title={browserTokenLabels.outdatedHint}
            >
              {browserTokenLabels.outdated}
            </StatusTag>
          ) : null}
          {!browser.outdated && expiry ? (
            <Text variant="compact" tone="muted">
              {expiry}
            </Text>
          ) : null}
        </footer>
      </article>
    </li>
  )
}

/** The browsers connected to the user's certificates, laid on their own
 *  desk below the certificates, each disconnectable.
 *  Hidden while there are none: "Conectar navegador" is in the hero. */
export function ConnectedBrowsers() {
  const { data: browsers = [] } = useConnectedBrowsers()
  const { data: switches } = useTokenSwitches()
  const disconnect = useDisconnectBrowser()
  const disconnectDialog = useTargetConfirmDialog<ConnectedBrowser>({
    title: browserTokenLabels.disconnectTitle,
    description: (browser) =>
      browserTokenLabels.disconnectDescription(browser.name),
    confirmLabel: browserTokenLabels.disconnect,
    onConfirm: (browser) => disconnect.mutateAsync({ id: browser.id }),
  })

  if (browsers.length === 0) return null

  return (
    <section className="@container mt-6 space-y-4 rounded-xl bg-desk p-3 sm:p-6">
      <div className="space-y-2 px-1 sm:px-0">
        <SectionHeading
          title={browserTokenLabels.section}
          count={browsers.length}
        />
        {switches?.tokenEnabled === false ? (
          <Text as="p" variant="meta" tone="destructive" role="status">
            {browserTokenLabels.tokenDisabled}
          </Text>
        ) : null}
      </div>
      <ul className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @2xl:gap-5">
        {browsers.map((browser) => (
          <BrowserCard
            key={browser.id}
            browser={browser}
            onDisconnect={disconnectDialog.open}
          />
        ))}
      </ul>
      <ConfirmDialog {...disconnectDialog.confirmDialogProps} />
    </section>
  )
}
