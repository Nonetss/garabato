import type { SyntheticEvent } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { TOTP_CODE_LENGTH } from "@/lib/one-time-code"
import { cn } from "@/lib/utils"

const ERROR_ID = "second-factor-error"

interface SecondFactorFormProps {
  code: string
  onCodeChange: (value: string) => void
  backupCodeMode: boolean
  onToggleBackupCodeMode: () => void
  trustDevice: boolean
  onTrustDeviceChange: (value: boolean) => void
  error: string
  loading: boolean
  onSubmit: (e: SyntheticEvent) => void
  onBack: () => void
}

/** Second sign-in step for users with two-factor authentication on. */
export function SecondFactorForm({
  code,
  onCodeChange,
  backupCodeMode,
  onToggleBackupCodeMode,
  trustDevice,
  onTrustDeviceChange,
  error,
  loading,
  onSubmit,
  onBack,
}: SecondFactorFormProps) {
  const invalid = error ? true : undefined
  const describedBy = error ? ERROR_ID : undefined

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Text as="p" variant="meta" tone="muted">
        {backupCodeMode
          ? "Introduce uno de los códigos de respaldo que guardaste al activar la verificación en dos pasos."
          : "Introduce el código de 6 dígitos de tu aplicación de autenticación."}
      </Text>

      {backupCodeMode ? (
        <FormField label="Código de respaldo" htmlFor="backup-code">
          <Input
            id="backup-code"
            type="text"
            required
            autoFocus
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="font-mono"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
          />
        </FormField>
      ) : (
        <FormField label="Código" htmlFor="totp-code">
          <Input
            id="totp-code"
            type="text"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern={`\\d{${TOTP_CODE_LENGTH}}`}
            minLength={TOTP_CODE_LENGTH}
            maxLength={TOTP_CODE_LENGTH}
            disabled={loading}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            placeholder="123456"
            className="font-mono tracking-[0.3em]"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
          />
        </FormField>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="trust-device"
          checked={trustDevice}
          disabled={loading}
          onCheckedChange={(checked) => onTrustDeviceChange(checked === true)}
        />
        <Label
          htmlFor="trust-device"
          className={cn(textVariants({ role: "compact" }), "font-normal")}
        >
          Confiar en este dispositivo durante 30 días
        </Label>
      </div>

      {error ? (
        <Text
          as="p"
          variant="meta"
          tone="destructive"
          id={ERROR_ID}
          role="alert"
        >
          {error}
        </Text>
      ) : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Spinner decorative />
            Comprobando…
          </>
        ) : (
          "Verificar"
        )}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={loading}
          onClick={onToggleBackupCodeMode}
        >
          {backupCodeMode
            ? "Usar la aplicación de autenticación"
            : "Usar un código de respaldo"}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={loading}
          onClick={onBack}
        >
          Volver
        </Button>
      </div>
    </form>
  )
}
