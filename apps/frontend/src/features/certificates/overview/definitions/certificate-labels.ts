import type { StatusDotTone } from "@/components/shared/data-display/status-dot"
import type { CertificateStatus } from "@/features/certificates/overview/model/types"

export const certificateLabels = {
  import: "Importar certificado",
  importSubmit: "Importar",
  importDescription:
    "Sube el archivo .p12 o .pfx de tu certificado. Se guarda cifrado y nunca se muestra ni se descarga.",
  file: "Archivo del certificado",
  fileHint: "Formato PKCS#12 (.p12 o .pfx), como lo exporta tu navegador.",
  fileRequired: "Elige el archivo .p12 o .pfx del certificado",
  fileTooLarge: "El archivo es demasiado grande para ser un certificado",
  password: "Contraseña del certificado",
  alias: "Nombre",
  aliasHint:
    "Para reconocerlo. Si lo dejas vacío se usa el nombre del titular.",
  rememberPassword: "Recordar la contraseña",
  rememberPasswordDescription: "Firmar sin escribir la contraseña cada vez",
  rememberPasswordHint:
    "Se guarda cifrada. Puedes olvidarla cuando quieras desde la lista.",
  signatures: "Ver firmas",
  rename: "Renombrar",
  renameTitle: "Renombrar certificado",
  remember: "Recordar contraseña",
  rememberTitle: "Recordar la contraseña",
  rememberDescription:
    "Escribe la contraseña del certificado. Se comprobará y se guardará cifrada para firmar sin pedírtela.",
  forget: "Olvidar contraseña",
  delete: "Eliminar",
  deleteTitle: "Eliminar certificado",
  deleteDescription: (alias: string) =>
    `Se eliminará "${alias}" de forma permanente, incluida su contraseña si estaba recordada. Para volver a usarlo tendrás que importarlo de nuevo.`,
  save: "Guardar",
  holder: "Titular",
  taxId: "NIF/NIE",
  issuer: "Emisor",
  expires: "Caduca",
  passwordColumn: "Contraseña",
  passwordRemembered: "Recordada",
  passwordAsked: "Se pide al firmar",
} as const

export const certificateStatusLabels: Record<
  CertificateStatus,
  { label: string; tone: StatusDotTone }
> = {
  valid: { label: "Vigente", tone: "foreground" },
  expiring: { label: "Caduca pronto", tone: "primary" },
  expired: { label: "Caducado", tone: "destructive" },
}
