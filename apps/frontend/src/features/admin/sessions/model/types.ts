import type { client } from "@/lib/orpc"

export type SessionRecord = Awaited<
  ReturnType<typeof client.v1.sessionHistory.list>
>["sessions"][number]
