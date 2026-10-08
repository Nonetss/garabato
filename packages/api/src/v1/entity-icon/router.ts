import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { entityIconHandler } from "#v1/entity-icon/handler"
import { entityIconInput } from "#v1/entity-icon/input"
import { entityIconOutput } from "#v1/entity-icon/output"

export const entityIconRouter = {
  getMany: protectedProcedure
    .meta(
      openapi({
        summary: "Get icons for entities",
        description:
          "Returns the icons of a batch of polymorphic entities (entityType + entityId). Entities without an icon or not readable by the caller are omitted.",
        tags: ["Entity icons"],
        method: "QUERY",
      })
    )
    .input(entityIconInput.getMany)
    .output(entityIconOutput.getMany)
    .handler(({ context, input }) =>
      entityIconHandler.getMany({ context, input })
    ),

  set: protectedProcedure
    .meta(
      openapi({
        summary: "Set an entity icon",
        description:
          "Creates or replaces the Lucide icon and palette color of an entity the caller may modify.",
        tags: ["Entity icons"],
        method: "PUT",
      })
    )
    .input(entityIconInput.set)
    .output(entityIconOutput.set)
    .handler(({ context, input }) => entityIconHandler.set({ context, input })),

  clear: protectedProcedure
    .meta(
      openapi({
        summary: "Clear an entity icon",
        description:
          "Removes the icon of an entity the caller may modify. Succeeds when the entity has no icon.",
        tags: ["Entity icons"],
        method: "DELETE",
      })
    )
    .input(entityIconInput.clear)
    .output(entityIconOutput.clear)
    .handler(({ context, input }) =>
      entityIconHandler.clear({ context, input })
    ),
}
