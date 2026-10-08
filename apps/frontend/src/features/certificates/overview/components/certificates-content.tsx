import { getIcon } from "@/lib/icon-registry"

const CertificateIcon = getIcon("navigation", "certificates")
const UploadIcon = getIcon("actions", "upload")

import { useState } from "react"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { EntityList } from "@/components/shared/resource/entity-list"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ImportCertificateDialog } from "@/features/certificates/overview/components/import-certificate-dialog"
import { RememberPasswordDialog } from "@/features/certificates/overview/components/remember-password-dialog"
import { RenameCertificateDialog } from "@/features/certificates/overview/components/rename-certificate-dialog"
import {
  type CertificatesRowContext,
  certificateDefinition,
} from "@/features/certificates/overview/definitions/certificate.definition"
import { certificateLabels } from "@/features/certificates/overview/definitions/certificate-labels"
import {
  useCertificateDelete,
  useCertificateForgetPassword,
  useCertificates,
} from "@/features/certificates/overview/hooks/use-certificates"
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

  const rowContext: CertificatesRowContext = {
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
        heroMeta={
          <HeroCount
            segments={[
              { count: usableCount, label: "vigentes" },
              { count: certificates.length, label: "total" },
            ]}
          />
        }
        heroAction={importButton}
        query={{ data: certificates, isPending, isError, refetch }}
        loading="Cargando certificados..."
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
      >
        {(data) => (
          <EntityList
            items={data}
            context={rowContext}
            definition={certificateDefinition}
          />
        )}
      </ResourceOverview>

      <ImportCertificateDialog open={importOpen} onOpenChange={setImportOpen} />
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
