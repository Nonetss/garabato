import { useAuthConfig } from "@/features/auth/shared"
import { SignUpClosed } from "@/features/auth/sign-up/components/sign-up-closed"
import { SignUpForm } from "@/features/auth/sign-up/components/sign-up-form"

/** The sign-up form, or a closed notice when the server disables sign-up. */
export function SignUpContent() {
  const { data: authConfig } = useAuthConfig()

  // Nothing until the config arrives, so a closed server never flashes the
  // form.
  if (!authConfig) return null
  if (!authConfig.signUpEnabled) return <SignUpClosed />
  return <SignUpForm />
}
