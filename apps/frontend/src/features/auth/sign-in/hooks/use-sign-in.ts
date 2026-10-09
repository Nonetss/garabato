import { type SyntheticEvent, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { navigate } from "@/lib/navigate"
import { totpCodeDigits } from "@/lib/one-time-code"

/** `credentials` asks for email and password; `second-factor` for the code. */
export type SignInStep = "credentials" | "second-factor"

const INVALID_CODE_MESSAGE =
  "El código no es válido o ha caducado. Inténtalo de nuevo."

/** Credential state + submit lifecycle for the sign-in form. */
export function useSignIn() {
  const [step, setStep] = useState<SignInStep>("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCodeValue] = useState("")
  const [backupCodeMode, setBackupCodeMode] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [oidcLoading, setOidcLoading] = useState(false)

  async function signInWithOidc() {
    setError("")
    setOidcLoading(true)

    try {
      await authClient.signIn.social(
        { provider: "oidc", callbackURL: "/" },
        {
          onError: (ctx) => {
            setError(
              ctx.error.message ||
                "No hemos podido iniciar sesión con SSO. Inténtalo de nuevo."
            )
            setOidcLoading(false)
          },
        }
      )
    } catch {
      setError(
        "No se pudo iniciar sesión con SSO. Comprueba tu conexión e inténtalo de nuevo."
      )
      setOidcLoading(false)
    }
  }

  async function submit(e: SyntheticEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await authClient.signIn.email(
        { email, password },
        {
          onSuccess: (ctx) => {
            // Two-factor users get no session yet: ask for their code.
            if (ctx.data?.twoFactorRedirect === true) {
              setStep("second-factor")
              return
            }
            navigate("/")
          },
          onError: (ctx) => {
            setError(
              ctx.error.message ||
                "No hemos podido iniciar sesión. Revisa tu email y tu contraseña."
            )
          },
        }
      )
    } catch {
      setError(
        "No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo."
      )
    } finally {
      setLoading(false)
    }
  }

  // TOTP codes keep only their digits; backup codes are taken as typed.
  function setCode(value: string) {
    if (backupCodeMode) {
      setCodeValue(value)
      return
    }
    setCodeValue(totpCodeDigits(value))
  }

  function toggleBackupCodeMode() {
    setBackupCodeMode((current) => !current)
    setCodeValue("")
    setError("")
  }

  function verifyCode() {
    if (backupCodeMode) {
      return authClient.twoFactor.verifyBackupCode({
        code: code.trim(),
        trustDevice,
      })
    }
    return authClient.twoFactor.verifyTotp({ code, trustDevice })
  }

  async function submitCode(e: SyntheticEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await verifyCode()
      if (result.error) {
        setError(INVALID_CODE_MESSAGE)
        return
      }
      navigate("/")
    } catch {
      setError(
        "No se pudo comprobar el código. Comprueba tu conexión e inténtalo de nuevo."
      )
    } finally {
      setLoading(false)
    }
  }

  /** Back to email and password, e.g. to sign in as someone else. */
  function backToCredentials() {
    setStep("credentials")
    setCodeValue("")
    setBackupCodeMode(false)
    setTrustDevice(false)
    setError("")
  }

  return {
    step,
    email,
    setEmail,
    password,
    setPassword,
    code,
    setCode,
    backupCodeMode,
    toggleBackupCodeMode,
    trustDevice,
    setTrustDevice,
    error,
    loading,
    submit,
    submitCode,
    backToCredentials,
    oidcLoading,
    signInWithOidc,
  }
}
