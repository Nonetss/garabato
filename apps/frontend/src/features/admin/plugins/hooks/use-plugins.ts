import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

export const usePluginsList = () =>
  useHydratedQuery(orpc.v1.plugins.list.queryOptions())
