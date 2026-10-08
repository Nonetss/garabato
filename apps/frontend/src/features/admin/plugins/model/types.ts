import type { AppRouterClient } from "@nonete/api/router"

export type Plugin = Awaited<
  ReturnType<AppRouterClient["v1"]["plugins"]["list"]>
>[number]
