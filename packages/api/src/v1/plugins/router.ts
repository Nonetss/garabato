import { openapi } from "@orpc/openapi"
import { adminProcedure, cronMeta } from "#index"

import { pluginsHandler } from "#v1/plugins/handler"
import { pluginsOutput } from "#v1/plugins/output"

export const pluginsRouter = {
  list: adminProcedure
    .meta(
      openapi({
        summary: "List installed Better Auth plugins",
        description:
          "Returns the list of Better Auth plugins currently configured on the server, by id. Useful for the admin panel's diagnostics view.",
        tags: ["Admin - Plugins", "Admin"],
        method: "GET",
      }),
      cronMeta({
        eligible: true,
      })
    )
    .output(pluginsOutput.list)
    .handler(() => pluginsHandler.list()),
}
