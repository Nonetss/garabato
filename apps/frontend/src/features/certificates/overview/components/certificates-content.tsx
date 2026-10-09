import { getIcon } from "@/lib/icon-registry"

const CertificateIcon = getIcon("navigation", "certificates")
const UploadIcon = getIcon("actions", "upload")

import { useState } from "react"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { FilterChips } from "@/components/shared/resource/filter-chips"
import {
  chipsFor,
  type ResourceFilterDescriptor,
  ResourceFilters,
} from "@/components/shared/resource/resource-filters"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  CertificateGrid,
  type CertificateGridContext,
} from "@/features/certificates/overview/components/certificate-grid"
import { CertificateSignaturesSheet } from "@/features/certificates/overview/components/certificate-signatures-sheet"
import { ImportCertificateDialog } from "@/features/certificates/overview/components/import-certificate-dialog"
import { RememberPasswordDialog } from "@/features/certificates/overview/components/remember-password-dialog"
import { RenameCertificateDialog } from "@/features/certificates/overview/components/rename-certificate-dialog"
import { certificateLabels } from "@/features/certificates/overview/definitions/certificate-labels"
import {
  useCertificateDelete,
  useCertificateForgetPassword,
  useCertificates,
} from "@/features/certificates/overview/hooks/use-certificates"
import { filterCertificates } from "@/features/certificates/overview/model/filters"
import type { Certificate } from "@/features/certificates/overview/model/types"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { useTargetDialog } from "@/hooks/use-target-dialog"

export function CertificatesContent() {
  const {
    data: certificates = [],
    isPending,
    isError,
    refetch,
  } = useCertificates()
  const forgetPassword = useCertificateForgetPassword()
  const deleteCertificate = useCertificateDelete()

  const [importOpen, setImportOpen] = useState(false)
  const [query, setQuery] = useState("")
  const signaturesSheet = useTargetDialog<Certificate>()
  const renameDialog = useTargetDialog<Certificate>()
  const rememberDialog = useTargetDialog<Certificate>()
  const deleteDialog = useTargetConfirmDialog<Certificate>({
    title: certificateLabels.deleteTitle,
    description: (certificate) =>
      certificateLabels.deleteDescription(certificate.alias),
    confirmLabel: certificateLabels.delete,
    onConfirm: (certificate) =>
      deleteCertificate.mutateAsync({ id: certificate.id }),
  })

  const usableCount = certificates.filter(
    (certificate) => certificate.status !== "expired"
  ).length

  const filterDescriptors: ResourceFilterDescriptor[] = [
    {
      kind: "search",
      key: "certificate-filter-query",
      label: certificateLabels.search,
      value: query,
      onChange: setQuery,
      placeholder: certificateLabels.searchPlaceholder,
    },
  ]
  const clearFilters = () => setQuery("")
  // Filtering only applies while there is something to filter: with no
  // certificates left, the page shows its import prompt, not "no matches".
  const filtering = certificates.length > 0 && query.trim() !== ""
  const listed = filterCertificates(certificates, query)

  const gridContext: CertificateGridContext = {
    onShowSignatures: signaturesSheet.open,
    onRename: renameDialog.open,
    onRememberPassword: rememberDialog.open,
    onForgetPassword: (certificate) =>
      forgetPassword.mutate({ id: certificate.id }),
    onDelete: deleteDialog.open,
  }

  const importButton = (
    <Button onClick={() => setImportOpen(true)}>
      <UploadIcon className="size-4" />
      {certificateLabels.import}
    </Button>
  )

  return (
    <>
      <ResourceOverview
        surface="certificates"
        heroAction={importButton}
        heroChildren={
          // Same ledger line as the document library, ruled off from the desk.
          certificates.length > 0 ? (
            <div className="border-b pb-4">
              <HeroCount
                segments={[
                  { count: usableCount, label: "vigentes" },
                  { count: certificates.length, label: "total" },
                ]}
              />
            </div>
          ) : null
        }
        filters={
          certificates.length > 0 ? (
            <div className="space-y-3">
              <ResourceFilters
                columns={1}
                filters={filterDescriptors}
                onClear={clearFilters}
              />
              <FilterChips
                chips={chipsFor(filterDescriptors)}
                onClear={clearFilters}
              />
            </div>
          ) : null
        }
        query={{ data: listed, isPending, isError, refetch }}
        loading="Cargando certificados…"
        error={{
          icon: <CertificateIcon className="size-6" />,
          title: "No se pudieron cargar los certificados",
          description:
            "Comprueba tu conexión; si el problema continúa, inténtalo de nuevo más tarde.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <CertificateIcon className="size-6" />,
          title: "Todavía no tienes certificados",
          description:
            "Importa el archivo .p12 o .pfx de tu certificado digital para poder firmar documentos con él.",
          action: importButton,
        }}
        hasActiveFilters={filtering}
        filteredEmpty={{
          icon: <CertificateIcon className="size-6" />,
          title: "Ningún certificado coincide con la búsqueda",
          description: "Prueba con otro nombre, titular, NIF/NIE o emisor.",
          onClear: clearFilters,
        }}
      >
        {(data) => (
          <CertificateGrid certificates={data} context={gridContext} />
        )}
      </ResourceOverview>

      <ImportCertificateDialog open={importOpen} onOpenChange={setImportOpen} />
      <CertificateSignaturesSheet
        certificate={signaturesSheet.target}
        {...signaturesSheet.dialogProps}
      />
      <RenameCertificateDialog
        certificate={renameDialog.target}
        {...renameDialog.dialogProps}
      />
      <RememberPasswordDialog
        certificate={rememberDialog.target}
        {...rememberDialog.dialogProps}
      />
      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
