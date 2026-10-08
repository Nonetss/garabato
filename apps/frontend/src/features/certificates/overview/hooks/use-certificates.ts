import type {
  Certificate,
  CertificateImportInput,
} from "@/features/certificates/overview/model/types"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const certificatesListKey = orpc.v1.certificate.list.queryKey()

export const useCertificates = () =>
  useHydratedQuery(orpc.v1.certificate.list.queryOptions())

export const useCertificateImport = () =>
  useOrpcMutation<Certificate, CertificateImportInput>({
    mutationFn: (input) => orpc.v1.certificate.import.call(input),
    success: "Certificado importado",
    error: "No se pudo importar el certificado",
    invalidate: [certificatesListKey],
  })

export const useCertificateRename = () =>
  useResourceMutation<
    { id: string; alias: string },
    Certificate,
    Certificate[]
  >({
    mutationFn: (input) => orpc.v1.certificate.rename.call(input),
    listKey: certificatesListKey,
    applyOptimistic: (current, input) =>
      current?.map((certificate) => {
        if (certificate.id !== input.id) return certificate
        return { ...certificate, alias: input.alias }
      }),
    messages: {
      success: "Certificado renombrado",
      error: "No se pudo renombrar el certificado",
    },
  })

export const useCertificateRememberPassword = () =>
  useOrpcMutation<Certificate, { id: string; password: string }>({
    mutationFn: (input) => orpc.v1.certificate.rememberPassword.call(input),
    success: "Contraseña recordada",
    error: "No se pudo recordar la contraseña",
    invalidate: [certificatesListKey],
  })

export const useCertificateForgetPassword = () =>
  useResourceMutation<{ id: string }, Certificate, Certificate[]>({
    mutationFn: (input) => orpc.v1.certificate.forgetPassword.call(input),
    listKey: certificatesListKey,
    applyOptimistic: (current, input) =>
      current?.map((certificate) => {
        if (certificate.id !== input.id) return certificate
        return { ...certificate, passwordRemembered: false }
      }),
    messages: {
      success: "Contraseña olvidada",
      error: "No se pudo olvidar la contraseña",
    },
  })

export const useCertificateDelete = () =>
  useResourceMutation<
    { id: string },
    { id: string; success: boolean },
    Certificate[]
  >({
    mutationFn: (input) => orpc.v1.certificate.delete.call(input),
    listKey: certificatesListKey,
    applyOptimistic: (current, input) =>
      current?.filter((certificate) => certificate.id !== input.id),
    messages: {
      success: "Certificado eliminado",
      error: "No se pudo eliminar el certificado",
    },
  })
