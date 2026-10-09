import { SignUpContent } from "@/features/auth/sign-up/components/sign-up-content"
import { QueryProvider } from "@/providers/query-provider"

export function SignUpPage() {
  return (
    <QueryProvider>
      <SignUpContent />
    </QueryProvider>
  )
}
