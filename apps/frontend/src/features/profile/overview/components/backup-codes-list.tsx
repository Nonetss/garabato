import { Text } from "@/components/shared/brand/typography"
import { CopyButton } from "@/components/shared/form/copy-button"

/** The one-time backup codes, shown once, with a copy-all button. */
export function BackupCodesList({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Text as="p" variant="label" tone="muted">
          Códigos de respaldo
        </Text>
        <CopyButton
          text={codes.join("\n")}
          label="Copiar códigos de respaldo"
          showSuccessToast
        />
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-4 py-3">
        {codes.map((code) => (
          <li key={code}>
            <Text variant="data" className="select-all">
              {code}
            </Text>
          </li>
        ))}
      </ul>
      <Text as="p" variant="meta" tone="muted">
        Guárdalos en un lugar seguro: cada uno sirve una sola vez para entrar si
        pierdes el acceso a tu aplicación de autenticación. No se volverán a
        mostrar.
      </Text>
    </div>
  )
}
