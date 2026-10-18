import { useQuery } from "@tanstack/react-query"
import type {
  ConnectedBrowser,
  StartedConnection,
} from "@/features/certificates/overview/model/browser-tokens"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const browsersListKey = orpc.v1.certificateToken.listKeys.queryKey()

// How often the dialog asks whether the install command has run.
const STATUS_POLL_MS = 2000

export const useConnectedBrowsers = () =>
  useHydratedQuery(orpc.v1.certificateToken.listKeys.queryOptions())

export const useStartConnection = () =>
  useOrpcMutation<StartedConnection, { name: string }>({
    mutationFn: (input) => orpc.v1.certificateToken.startConnection.call(input),
    error: "No se pudo preparar la conexión del navegador",
  })

/** Polls a started connection while it is pending; stops once it connects
 *  or expires. */
export const useConnectionStatus = (code: string | null) =>
  useQuery({
    ...orpc.v1.certificateToken.connectionStatus.queryOptions({
      input: { code: code ?? "" },
    }),
    enabled: code !== null,
    refetchInterval: (query) => {
      if (query.state.data?.state === "pending") return STATUS_POLL_MS
      return false
    },
  })

export const useDisconnectBrowser = () =>
  useResourceMutation<
    { id: string },
    { id: string; success: boolean },
    ConnectedBrowser[]
  >({
    mutationFn: (input) => orpc.v1.certificateToken.revokeKey.call(input),
    listKey: browsersListKey,
    applyOptimistic: (current, input) =>
      current?.filter((browser) => browser.id !== input.id),
    messages: {
      success: "Navegador desconectado",
      error: "No se pudo desconectar el navegador",
    },
  })

export { browsersListKey }
