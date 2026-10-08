import { getIcon } from "@/lib/icon-registry"

const SignIcon = getIcon("actions", "sign")
const EditIcon = getIcon("actions", "edit")
const DeleteIcon = getIcon("actions", "delete")
const RememberIcon = getIcon("security", "rememberPassword")
const ForgetIcon = getIcon("security", "forgetPassword")
const LockedIcon = getIcon("security", "locked")

import { Text } from "@/components/shared/brand/typography"
import { RowActionsMenu } from "@/components/shared/data-display/row-actions-menu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { CertificateValidityLine } from "@/features/certificates/overview/components/certificate-validity-line"
import { certificateLabels } from "@/features/certificates/overview/definitions/certificate-labels"
import type { Certificate } from "@/features/certificates/overview/model/types"
import { cn } from "@/lib/utils"

// Past this many cards the entrance stops staggering further.
const MAX_STAGGER_INDEX = 8

export interface CertificateGridContext {
  onShowSignatures: (certificate: Certificate) => void
  onRename: (certificate: Certificate) => void
  onRememberPassword: (certificate: Certificate) => void
  onForgetPassword: (certificate: Certificate) => void
  onDelete: (certificate: Certificate) => void
}

function PasswordState({ remembered }: { remembered: boolean }) {
  if (remembered) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <RememberIcon className="size-3.5 shrink-0" />
        <Text variant="compact" className="truncate">
          {certificateLabels.passwordRememberedNote}
        </Text>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <LockedIcon className="size-3.5 shrink-0" />
      <Text variant="compact" className="truncate">
        {certificateLabels.passwordAsked}
      </Text>
    </span>
  )
}

function PasswordMenuItem({
  certificate,
  context,
}: {
  certificate: Certificate
  context: CertificateGridContext
}) {
  if (certificate.passwordRemembered) {
    return (
      <DropdownMenuItem onClick={() => context.onForgetPassword(certificate)}>
        <ForgetIcon className="size-4" />
        {certificateLabels.forget}
      </DropdownMenuItem>
    )
  }
  return (
    <DropdownMenuItem onClick={() => context.onRememberPassword(certificate)}>
      <RememberIcon className="size-4" />
      {certificateLabels.remember}
    </DropdownMenuItem>
  )
}

function CertificateCard({
  certificate,
  context,
  now,
  index,
}: {
  certificate: Certificate
  context: CertificateGridContext
  now: Date
  index: number
}) {
  const expired = certificate.status === "expired"
  // The holder repeats the name when the alias was left as the default.
  const showHolder = certificate.commonName !== certificate.alias
  const delay = Math.min(index, MAX_STAGGER_INDEX) * 40

  return (
    <li className="dash-enter" style={{ animationDelay: `${delay}ms` }}>
      <article className="group flex h-full flex-col rounded-lg bg-background shadow-sheet">
        <div
          className={cn(
            "flex flex-1 flex-col gap-6 p-5 transition-opacity",
            expired && "opacity-60 group-hover:opacity-100"
          )}
        >
          <header className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5 pt-1.5">
              <Text as="h3" variant="headline" className="truncate">
                {certificate.alias}
              </Text>
              {showHolder ? (
                <Text as="p" variant="meta" tone="muted" className="truncate">
                  {certificate.commonName}
                </Text>
              ) : null}
            </div>
            <div className="-mt-1 -mr-2 shrink-0">
              <RowActionsMenu label={`Acciones de ${certificate.alias}`}>
                <DropdownMenuItem onClick={() => context.onRename(certificate)}>
                  <EditIcon className="size-4" />
                  {certificateLabels.rename}
                </DropdownMenuItem>
                <PasswordMenuItem certificate={certificate} context={context} />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => context.onDelete(certificate)}
                >
                  <DeleteIcon className="size-4" />
                  {certificateLabels.delete}
                </DropdownMenuItem>
              </RowActionsMenu>
            </div>
          </header>

          <dl className="flex gap-6">
            <div className="shrink-0 space-y-1">
              <Text as="dt" variant="label" tone="muted">
                {certificateLabels.taxId}
              </Text>
              <Text as="dd" variant="data" className="text-sm">
                {certificate.taxId ?? "—"}
              </Text>
            </div>
            <div className="min-w-0 space-y-1">
              <Text as="dt" variant="label" tone="muted">
                {certificateLabels.issuer}
              </Text>
              <Text as="dd" variant="body" className="truncate">
                {certificate.issuerCommonName}
              </Text>
            </div>
          </dl>

          <div className="mt-auto">
            <CertificateValidityLine
              certificate={certificate}
              now={now}
              delayMs={delay + 150}
            />
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t py-2 pr-2 pl-5">
          <PasswordState remembered={certificate.passwordRemembered} />
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => context.onShowSignatures(certificate)}
          >
            <SignIcon className="size-4" />
            {certificateLabels.signatures}
          </Button>
        </footer>
      </article>
    </li>
  )
}

/** The certificates laid on the desk as credentials, one sheet each. */
export function CertificateGrid({
  certificates,
  context,
}: {
  certificates: Certificate[]
  context: CertificateGridContext
}) {
  const now = new Date()

  return (
    <div className="@container rounded-xl bg-desk p-3 sm:p-6">
      <ul className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @2xl:gap-5">
        {certificates.map((certificate, index) => (
          <CertificateCard
            key={certificate.id}
            certificate={certificate}
            context={context}
            now={now}
            index={index}
          />
        ))}
      </ul>
    </div>
  )
}
