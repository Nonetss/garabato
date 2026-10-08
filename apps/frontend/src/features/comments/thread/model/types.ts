import type { AppRouterClient } from "@nonete/api/router"

export type Comment = Awaited<
  ReturnType<AppRouterClient["v1"]["comment"]["list"]>
>[number]

export type CommentEntityRef = {
  entityType: string
  entityId: string
}
