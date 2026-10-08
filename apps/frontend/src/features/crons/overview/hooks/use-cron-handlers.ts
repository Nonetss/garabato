import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

export const useCronHandlers = () =>
  useHydratedQuery(orpc.v1.cron.handlers.queryOptions())
