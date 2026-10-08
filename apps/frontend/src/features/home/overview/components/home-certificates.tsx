import { getIcon } from "@/lib/icon-registry"

const ArrowRightIcon = getIcon("navigation", "forward")

import { Text } from "@/components/shared/brand/typography"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  type Certificate,
  certificateLabels,
  certificateStatusLabels,
  useCertificates,
} from "@/features/certificates"
import { getAppSurface } from "@/lib/app-surfaces"
import { formatDate } from "@/lib/format"

function passwordNote(certificate: Certificate) {
  if (certificate.passwordRemembered) return "Firma sin pedir contraseña"
  return "Pide la contraseña al firmar"
}

function CertificateRow({ certificate }: { certificate: Certificate }) {
  const status = certificateStatusLabels[certificate.status]

  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <Text variant="title" className="truncate">
          {certificate.alias}
        </Text>
        <StatusTag dotTone={status.tone} className="shrink-0">
          {status.label}
        </StatusTag>
      </div>
      <Text as="p" variant="compact" tone="muted" className="truncate">
        {certificate.commonName}
      </Text>
      <Text as="p" variant="compact" tone="muted" className="tabular-nums">
        {certificateLabels.expires} {formatDate(certificate.notAfter)} ·{" "}
        {passwordNote(certificate)}
      </Text>
    </li>
  )
}

function CertificatesBody() {
  const { data: certificates = [], isPending, isError } = useCertificates()
  const certificatesPath = getAppSurface("certificates").path

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <Text as="p" variant="meta" tone="muted">
        No se pudieron cargar tus certificados.
      </Text>
    )
  }

  if (certificates.length === 0) {
    return (
      <div className="space-y-3">
        <Text as="p" variant="meta" tone="muted" className="text-pretty">
          Para firmar necesitas un certificado digital (.p12 o .pfx). Se guarda
          cifrado.
        </Text>
        <Button variant="outline" render={<AppLink href={certificatesPath} />}>
          {certificateLabels.import}
        </Button>
      </div>
    )
  }

  return (
    <ul className="divide-y">
      {certificates.map((certificate) => (
        <CertificateRow key={certificate.id} certificate={certificate} />
      ))}
    </ul>
  )
}

/**
 * The home's side column: which certificates can sign, whether they still
 * hold and whether they ask for a password, then the way into the library.
 */
export function HomeCertificates() {
  const certificates = getAppSurface("certificates")
  const documents = getAppSurface("documents")

  return (
    <aside className="space-y-8">
      <section className="space-y-4">
        <SectionHeading
          title="Firmarás con"
          action={
            <AppLink
              href={certificates.path}
              className="text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
              Gestionar
            </AppLink>
          }
        />
        <CertificatesBody />
      </section>

      <section className="space-y-3 border-t pt-6">
        <SectionHeading title="Tu biblioteca" />
        <AppLink
          href={documents.path}
          className="group/link flex items-center justify-between gap-3 rounded-md py-1 text-foreground transition-colors hover:text-primary"
        >
          <Text variant="title">Ver todos los documentos</Text>
          <ArrowRightIcon className="size-4 transition-transform group-hover/link:translate-x-0.5" />
        </AppLink>
        <Text as="p" variant="compact" tone="muted" className="text-pretty">
          Cada PDF guarda sus versiones y el registro de quién lo firmó y con
          qué certificado.
        </Text>
      </section>
    </aside>
  )
}
