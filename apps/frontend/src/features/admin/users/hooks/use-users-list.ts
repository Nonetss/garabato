import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { authClient, unwrapAuth } from "@/lib/auth-client"

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

export function useUsersList() {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput)
      setPage(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const query = useQuery({
    queryKey: ["admin", "users", search, page],
    queryFn: () =>
      unwrapAuth(
        authClient.admin.listUsers({
          query: {
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
            sortBy: "createdAt",
            sortDirection: "desc",
            ...(search
              ? {
                  searchField: search.includes("@") ? "email" : "name",
                  searchOperator: "contains",
                  searchValue: search,
                }
              : {}),
          },
        })
      ),
    placeholderData: (previous) => previous,
  })

  return {
    users: query.data?.users ?? [],
    total: query.data?.total ?? 0,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    searchInput,
    setSearchInput,
    page,
    setPage,
    pageSize: PAGE_SIZE,
  }
}
