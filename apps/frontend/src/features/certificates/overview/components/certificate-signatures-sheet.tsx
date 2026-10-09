import { Text, textVariants } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { AppLink } from "@/components/ui/app-link"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { Certificate } from "@/features/certificates/overview/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { formatDateTime, joinFacts } from "@/lib/format"
import { orpc } from "@/lib/orpc"

type SignatureEntry = {
  id: string
  documentId: string
  documentName: string
  documentDeleted: boolean
  versionNumber: number
  signedAt: string
  visible: boolean
  pages: number[]
}

function placementLabel(entry: SignatureEntry) {
  if (!entry.visible) return "invisible"
  const pages = entry.pages.map((page) => page + 1).join(", ")
  return `pág. ${pages}`
}

function DocumentName({ entry }: { entry: SignatureEntry }) {
  if (entry.documentDeleted) {
    return (
      <Text tone="muted" variant="title">
        {entry.documentName} (eliminado)
      </Text>
    )
  }
  return (
    <AppLink href={`/documents/${entry.documentId}`}>
      {entry.documentName}
    </AppLink>
  )
}

function SignatureList({ certificateId }: { certificateId: string }) {
  const { data = [], isPending } = useHydratedQuery(
    orpc.v1.document.signatures.queryOptions({ input: { certificateId } })
  )
  if (isPending) return <Skeleton className="h-24 w-full" />
  if (data.length === 0) {
    return (
      <Text as="p" variant="meta" tone="muted">
        Todavía no has firmado nada con este certificado.
      </Text>
    )
  }
  return (
    <SoftCardList as="ul">
      {data.map((entry) => (
        <SoftCardListItem
          key={entry.id}
          title={<DocumentName entry={entry} />}
          description={joinFacts([
            formatDateTime(entry.signedAt, { includeYear: true }),
            `v${entry.versionNumber}`,
            placementLabel(entry),
          ])}
        />
      ))}
    </SoftCardList>
  )
}

interface CertificateSignaturesSheetProps {
  certificate: Certificate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The signatures made with one certificate, newest first. */
export function CertificateSignaturesSheet({
  certificate,
  open,
  onOpenChange,
}: CertificateSignaturesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{certificate?.alias ?? "Certificado"}</SheetTitle>
          <SheetDescription className={textVariants({ role: "compact" })}>
            Firmas hechas con este certificado
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {certificate ? (
            <SignatureList certificateId={certificate.id} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
