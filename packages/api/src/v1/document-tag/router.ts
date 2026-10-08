import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { documentTagHandler } from "#v1/document-tag/handler"
import { documentTagInput } from "#v1/document-tag/input"
import { documentTagOutput } from "#v1/document-tag/output"

export const documentTagRouter = {
  list: protectedProcedure
    .meta(
      openapi({
        summary: "List my document tags",
        description:
          "Returns the caller's document tags ordered by name, each with its palette color and the number of live documents that carry it.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .output(documentTagOutput.list)
    .handler(({ context }) => documentTagHandler.list({ context })),

  create: protectedProcedure
    .meta(
      openapi({
        summary: "Create a document tag",
        description:
          "Creates a tag with a name, unique among the caller's tags ignoring case (CONFLICT otherwise), and a palette color (`neutral` by default).",
        tags: ["Documents"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(documentTagInput.create)
    .output(documentTagOutput.create)
    .handler(({ context, input }) =>
      documentTagHandler.create({ context, input })
    ),

  update: protectedProcedure
    .meta(
      openapi({
        summary: "Rename or recolor a document tag",
        description:
          "Changes the name, the color or both of one of the caller's tags; an omitted field keeps its value. A name another tag already uses, ignoring case, answers CONFLICT.",
        tags: ["Documents"],
        method: "PATCH",
      })
    )
    .input(documentTagInput.update)
    .output(documentTagOutput.update)
    .handler(({ context, input }) =>
      documentTagHandler.update({ context, input })
    ),

  delete: protectedProcedure
    .meta(
      openapi({
        summary: "Delete a document tag",
        description:
          "Deletes one of the caller's tags and removes it from every document that carried it.",
        tags: ["Documents"],
        method: "DELETE",
      })
    )
    .input(documentTagInput.delete)
    .output(documentTagOutput.delete)
    .handler(({ context, input }) =>
      documentTagHandler.delete({ context, input })
    ),
}
