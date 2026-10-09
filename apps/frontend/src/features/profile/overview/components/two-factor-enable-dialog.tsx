import { QRCodeSVG } from "qrcode.react"
import { type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { CopyButton } from "@/components/shared/form/copy-button"
import type { DialogFieldDescriptor } from "@/components/shared/form/dialog-fields"
import { FormField } from "@/components/shared/form/field-label"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { Input } from "@/components/ui/input"
import { BackupCodesList } from "@/features/profile/overview/components/backup-codes-list"
import {
  type TotpEnrolment,
  useConfirmTwoFactor,
  useStartTwoFactor,
} from "@/features/profile/overview/hooks/use-two-factor"
import { totpSecretOf } from "@/features/profile/overview/model/totp"
import { useDialogForm } from "@/hooks/use-dialog-form"
import { useOnOpen } from "@/hooks/use-on-open"
import { TOTP_CODE_LENGTH, totpCodeDigits } from "@/lib/one-time-code"

interface PasswordValues {
  password: string
}

const emptyValues: PasswordValues = { password: "" }

const fields: DialogFieldDescriptor<PasswordValues>[] = [
  {
    kind: "password",
    key: "password",
    label: "Contraseña",
    required: true,
    autoComplete: "current-password",
    autoFocus: true,
  },
]

interface TwoFactorEnableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Turns two-factor on in two steps: the password unlocks a new secret (QR
 * code and backup codes), then a code from the app confirms it. Closing the
 * dialog before confirming leaves two-factor off.
 */
export function TwoFactorEnableDialog({
  open,
  onOpenChange,
}: TwoFactorEnableDialogProps) {
  const start = useStartTwoFactor()
  const confirm = useConfirmTwoFactor()
  const form = useDialogForm(open, emptyValues)
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null)
  const [code, setCode] = useState("")

  useOnOpen(open, () => {
    setEnrolment(null)
    setCode("")
  })

  const submitPassword = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { password } = form.values
    setEnrolment(await start.mutateAsync({ password }))
  }

  const submitCode = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    await confirm.mutateAsync({ code })
    onOpenChange(false)
  }

  if (!enrolment) {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Activar verificación en dos pasos"
        description="Confirma tu contraseña para generar la clave de tu aplicación de autenticación."
        onSubmit={submitPassword}
        isPending={start.isPending}
        submitLabel="Continuar"
        form={form}
        fields={fields}
      />
    )
  }

  const secret = totpSecretOf(enrolment.totpURI)

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Activar verificación en dos pasos"
      description="Escanea el código con tu aplicación de autenticación (Google Authenticator, 1Password, Aegis…) e introduce el código que muestre."
      onSubmit={submitCode}
      isPending={confirm.isPending}
      submitLabel="Activar"
      submitDisabled={code.length !== TOTP_CODE_LENGTH}
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="rounded-md bg-white p-3">
            <QRCodeSVG
              value={enrolment.totpURI}
              size={168}
              title="Código QR de la verificación en dos pasos"
            />
          </div>
        </div>

        {secret ? (
          <div className="space-y-1">
            <Text as="p" variant="label" tone="muted">
              Clave para introducirla a mano
            </Text>
            <div className="flex items-center gap-2">
              <Text variant="data" className="min-w-0 break-all select-all">
                {secret}
              </Text>
              <CopyButton text={secret} label="Copiar clave" />
            </div>
          </div>
        ) : null}

        <BackupCodesList codes={enrolment.backupCodes} />

        <FormField label="Código de la aplicación" htmlFor="two-factor-code">
          <Input
            id="two-factor-code"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="font-mono tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(totpCodeDigits(e.target.value))}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}
