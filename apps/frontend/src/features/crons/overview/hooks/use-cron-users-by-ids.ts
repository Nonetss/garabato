import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"

/** Batch lookup for list rows. Prefer `getUser` over `listUsers`+`in`: the
 * GET array filter breaks and Better Auth returns an empty list on error. */
export function useCronUsersByIds(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)].sort()

  const query = useQuery({
    queryKey: ["admin", "users", "byIds", uniqueIds],
    queryFn: async () => {
      const users = await Promise.all(
        uniqueIds.map(async (id) => {
          const { data, error } = await authClient.admin.getUser({
            query: { id },
          })
          if (error || !data) return null
          return data
        })
      )
      return users.filter((user) => user != null)
    },
    enabled: uniqueIds.length > 0,
  })

  return new Map(query.data?.map((user) => [user.id, user]))
}
