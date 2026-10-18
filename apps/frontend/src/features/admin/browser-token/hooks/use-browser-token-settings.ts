import type {
  BrowserTokenSettings,
  SwitchValues,
} from "@/features/admin/browser-token/model/settings"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { orpc } from "@/lib/orpc"

export const useBrowserTokenSettings = () =>
  useHydratedQuery(orpc.v1.certificateToken.settings.queryOptions())

export const useUpdateBrowserTokenSettings = () =>
  useOrpcMutation<BrowserTokenSettings, SwitchValues>({
    mutationFn: (input) => orpc.v1.certificateToken.updateSettings.call(input),
    success: "Ajustes del token guardados",
    error: "No se pudieron guardar los ajustes del token",
    invalidate: [
      orpc.v1.certificateToken.settings.queryKey(),
      orpc.v1.certificateToken.switches.queryKey(),
      orpc.v1.certificateToken.listKeys.queryKey(),
    ],
  })
