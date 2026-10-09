import { useQuery } from "@tanstack/react-query"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { authClient, unwrapAuth } from "@/lib/auth-client"

const accountsKey = ["auth", "accounts"] as const

/**
 * Whether the signed-in user has a password (a `credential` account). Two-
 * factor guards password sign-in only, so SSO-only users cannot turn it on.
 */
export function useHasPassword() {
  return useQuery({
    queryKey: accountsKey,
    queryFn: () => unwrapAuth(authClient.listAccounts()),
    select: (accounts) =>
      accounts.some((account) => account.providerId === "credential"),
  })
}

/** What the authenticator app needs, shown once while enrolling. */
export interface TotpEnrolment {
  totpURI: string
  backupCodes: string[]
}

async function startTotpEnrolment(password: string): Promise<TotpEnrolment> {
  const result = await unwrapAuth(
    authClient.twoFactor.enable({ password, method: "totp" })
  )
  if (result.method !== "totp") {
    throw new Error("El servidor no ha devuelto la clave de la aplicación")
  }
  return { totpURI: result.totpURI, backupCodes: result.backupCodes }
}

/** Step 1 of enrolment: returns the TOTP URI and the backup codes. */
export function useStartTwoFactor() {
  return useOrpcMutation({
    mutationFn: (input: { password: string }) =>
      startTotpEnrolment(input.password),
    error: "No se pudo activar la verificación en dos pasos",
  })
}

/** Step 2 of enrolment: a valid code turns two-factor on. */
export function useConfirmTwoFactor() {
  return useOrpcMutation({
    mutationFn: (input: { code: string }) =>
      unwrapAuth(authClient.twoFactor.verifyTotp({ code: input.code })),
    success: "Verificación en dos pasos activada",
    error: "El código no es válido",
  })
}

export function useDisableTwoFactor() {
  return useOrpcMutation({
    mutationFn: (input: { password: string }) =>
      unwrapAuth(authClient.twoFactor.disable({ password: input.password })),
    success: "Verificación en dos pasos desactivada",
    error: "No se pudo desactivar la verificación en dos pasos",
  })
}

/** Replaces the backup codes; the previous set stops working. */
export function useRegenerateBackupCodes() {
  return useOrpcMutation({
    mutationFn: (input: { password: string }) =>
      unwrapAuth(
        authClient.twoFactor.generateBackupCodes({ password: input.password })
      ),
    success: "Códigos de respaldo generados",
    error: "No se pudieron generar los códigos de respaldo",
  })
}
