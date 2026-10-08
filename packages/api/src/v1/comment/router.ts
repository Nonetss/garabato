import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { commentHandler } from "#v1/comment/handler"
import { commentInput } from "#v1/comment/input"
import { commentOutput } from "#v1/comment/output"

export const commentRouter = {
  list: protectedProcedure
    .meta(
      openapi({
        summary: "List comments for an entity",
        description:
          "Returns comments attached to a polymorphic entity (entityType + entityId), nested as a reply tree. Soft-deleted roots without replies are omitted.",
        tags: ["Comments"],
        method: "GET",
      })
    )
    .input(commentInput.list)
    .output(commentOutput.list)
    .handler(({ input }) => commentHandler.list({ input })),

  counts: protectedProcedure
    .meta(
      openapi({
        summary: "Count comments for entities",
        description:
          "Returns non-deleted comment counts for a batch of entities.",
        tags: ["Comments"],
        method: "QUERY",
      })
    )
    .input(commentInput.counts)
    .output(commentOutput.counts)
    .handler(({ input }) => commentHandler.counts({ input })),

  create: protectedProcedure
    .meta(
      openapi({
        summary: "Create a comment",
        description:
          "Creates a comment (or reply) on a polymorphic entity. Requires authentication.",
        tags: ["Comments"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(commentInput.create)
    .output(commentOutput.create)
    .handler(({ context, input }) => commentHandler.create({ context, input })),

  update: protectedProcedure
    .meta(
      openapi({
        summary: "Update a comment",
        description: "Updates the content of a comment owned by the caller.",
        tags: ["Comments"],
        method: "PATCH",
      })
    )
    .input(commentInput.update)
    .output(commentOutput.update)
    .handler(({ context, input }) => commentHandler.update({ context, input })),

  delete: protectedProcedure
    .meta(
      openapi({
        summary: "Delete a comment",
        description: "Soft-deletes a comment owned by the caller.",
        tags: ["Comments"],
        method: "DELETE",
      })
    )
    .input(commentInput.delete)
    .output(commentOutput.delete)
    .handler(({ context, input }) => commentHandler.delete({ context, input })),
}
