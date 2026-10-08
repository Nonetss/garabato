import { type SyntheticEvent, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { navigate } from "@/lib/navigate"

/** Account state + submit lifecycle for the sign-up form. */
export function useSignUp() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: SyntheticEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await authClient.signUp.email(
        { name, email, password },
        {
          onSuccess: () => {
            navigate("/")
          },
          onError: (ctx) => {
            setError(
              ctx.error.message ||
                "No hemos podido crear la cuenta. Revisa los datos e inténtalo de nuevo."
            )
          },
        }
      )
    } catch {
      setError(
        "No se pudo crear la cuenta. Comprueba tu conexión e inténtalo de nuevo."
      )
    } finally {
      setLoading(false)
    }
  }

  return {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    submit,
  }
}
