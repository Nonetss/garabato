import { SignInContent } from "@/features/auth/sign-in/components/sign-in-content"
import { QueryProvider } from "@/providers/query-provider"

export function SignInPage() {
  return (
    <QueryProvider>
      <SignInContent />
    </QueryProvider>
  )
}
