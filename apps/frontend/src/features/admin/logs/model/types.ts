import type { client } from "@/lib/orpc"

export type ActivityLogEntry = Awaited<
  ReturnType<typeof client.v1.logs.query>
>["entries"][number]

export type ActivityTypeFilter = "all" | "page_view" | "api_call"

export type HttpMethodFilter =
  | "all"
  | "GET"
  | "QUERY"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"

export interface ActivityLogFilters {
  userId: string
  type: ActivityTypeFilter
  method: HttpMethodFilter
  path: string
  /** Calendar day lower bound, interpreted as 00:00 local. */
  from: Date | undefined
  /** Calendar day upper bound, interpreted as 23:59:59.999 local (inclusive). */
  to: Date | undefined
}
