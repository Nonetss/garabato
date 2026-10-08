import { type SyntheticEvent, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { navigate } from "@/lib/navigate"

/** Credential state + submit lifecycle for the sign-in form. */
export function useSignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
          onSuccess: () => {
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

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    submit,
    oidcLoading,
    signInWithOidc,
  }
}
