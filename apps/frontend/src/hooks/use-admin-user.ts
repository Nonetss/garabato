import { useQuery } from "@tanstack/react-query"
import { authClient, unwrapAuth } from "@/lib/auth-client"

/** Single-user lookup by id, shared by every detail view that shows "runs as" / "actor" info (cron detail, log filter). */
export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => {
      if (!userId) return null
      return unwrapAuth(authClient.admin.getUser({ query: { id: userId } }))
    },
    enabled: !!userId,
  })
}
