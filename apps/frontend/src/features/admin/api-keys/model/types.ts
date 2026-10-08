import type { AppRouterClient } from "@nonete/api/router"

export type ApiKey = NonNullable<
  Awaited<ReturnType<AppRouterClient["v1"]["apiKey"]["create"]>>
>

export type ApiKeyListItem = Awaited<
  ReturnType<AppRouterClient["v1"]["apiKey"]["list"]>
>[number]
