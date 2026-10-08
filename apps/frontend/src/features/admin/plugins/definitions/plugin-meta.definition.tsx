import type { ReactNode } from "react"
import { getIcon } from "@/lib/icon-registry"

const Building2 = getIcon("entities", "organization")
const KeyRound = getIcon("entities", "apiKey")
const ShieldCheck = getIcon("security", "verified")
const Sparkles = getIcon("admin", "sparkle")

export const pluginMeta: Record<
  string,
  { label: string; description: string; icon: ReactNode }
> = {
  admin: {
    label: "Admin",
    description:
      "Gestión de usuarios: crear cuentas, banear, eliminar y cambiar roles.",
    icon: <ShieldCheck className="size-4" />,
  },
  "api-key": {
    label: "API Key",
    description: "Emisión y gestión de claves de API para integraciones.",
    icon: <KeyRound className="size-4" />,
  },
  organization: {
    label: "Organization",
    description:
      "Organizaciones, miembros, invitaciones y equipos (teams habilitado).",
    icon: <Building2 className="size-4" />,
  },
}

export const defaultPluginIcon = <Sparkles className="size-4" />
