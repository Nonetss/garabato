import { getIcon } from "@/lib/icon-registry"

const DisconnectIcon = getIcon("actions", "delete")

import { Text } from "@/components/shared/brand/typography"
import { IconButton } from "@/components/shared/form/icon-button"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { browserTokenLabels } from "@/features/certificates/overview/definitions/browser-token-labels"
import {
  useConnectedBrowsers,
  useDisconnectBrowser,
} from "@/features/certificates/overview/hooks/use-browser-tokens"
import type { ConnectedBrowser } from "@/features/certificates/overview/model/browser-tokens"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { formatDate, formatRelativeTime, joinFacts } from "@/lib/format"

function lastUseLabel(browser: ConnectedBrowser) {
  if (browser.lastUsedAt === null) return browserTokenLabels.neverUsed
  return browserTokenLabels.lastUsed(formatRelativeTime(browser.lastUsedAt))
}

function expiryLabel(browser: ConnectedBrowser) {
  if (browser.expiresAt === null) return ""
  return browserTokenLabels.expires(formatDate(browser.expiresAt))
}

function BrowserRow({
  browser,
  onDisconnect,
}: {
  browser: ConnectedBrowser
  onDisconnect: (browser: ConnectedBrowser) => void
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <Text as="p" variant="title" className="truncate">
          {browser.name}
        </Text>
        <Text as="p" variant="meta" tone="muted" className="truncate">
          {joinFacts([lastUseLabel(browser), expiryLabel(browser)])}
        </Text>
      </div>
      <IconButton
        label={`${browserTokenLabels.disconnect} ${browser.name}`}
        icon={DisconnectIcon}
        variant="ghost"
        size="icon-sm"
        onClick={() => onDisconnect(browser)}
        className="text-muted-foreground"
      />
    </li>
  )
}

/** The browsers connected to the user's certificates, each disconnectable.
 *  Hidden while there are none: "Conectar navegador" is in the hero. */
export function ConnectedBrowsers() {
  const { data: browsers = [] } = useConnectedBrowsers()
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
    <section className="mt-10 space-y-2">
      <SectionHeading
        title={browserTokenLabels.section}
        count={browsers.length}
      />
      <ul className="divide-y border-y">
        {browsers.map((browser) => (
          <BrowserRow
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
