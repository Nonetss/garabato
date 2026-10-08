import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { documentFolderHandler } from "#v1/document-folder/handler"
import { documentFolderInput } from "#v1/document-folder/input"
import { documentFolderOutput } from "#v1/document-folder/output"

export const documentFolderRouter = {
  list: protectedProcedure
    .meta(
      openapi({
        summary: "List my document folders",
        description:
          "Returns every folder of the caller's document library, ordered by name, with its parent (null for top-level folders) and the number of live documents directly inside it.",
        tags: ["Documents"],
        method: "GET",
      })
    )
    .output(documentFolderOutput.list)
    .handler(({ context }) => documentFolderHandler.list({ context })),

  create: protectedProcedure
    .meta(
      openapi({
        summary: "Create a document folder",
        description:
          "Creates a folder in the library root or inside one of the caller's folders. Names are unique among siblings ignoring case (CONFLICT otherwise), and folders nest at most 10 levels deep (CONFLICT).",
        tags: ["Documents"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(documentFolderInput.create)
    .output(documentFolderOutput.create)
    .handler(({ context, input }) =>
      documentFolderHandler.create({ context, input })
    ),

  rename: protectedProcedure
    .meta(
      openapi({
        summary: "Rename a document folder",
        description:
          "Changes the name of one of the caller's folders. Control characters are stripped; a name already used by a sibling, ignoring case, answers CONFLICT.",
        tags: ["Documents"],
        method: "PATCH",
      })
    )
    .input(documentFolderInput.rename)
    .output(documentFolderOutput.rename)
    .handler(({ context, input }) =>
      documentFolderHandler.rename({ context, input })
    ),

  move: protectedProcedure
    .meta(
      openapi({
        summary: "Move a document folder",
        description:
          "Moves one of the caller's folders, with its contents, under another of their folders or to the library root (`parentId: null`). Moving it into itself or a descendant answers BAD_REQUEST; a sibling with the same name or ending deeper than 10 levels answers CONFLICT.",
        tags: ["Documents"],
        method: "PATCH",
      })
    )
    .input(documentFolderInput.move)
    .output(documentFolderOutput.move)
    .handler(({ context, input }) =>
      documentFolderHandler.move({ context, input })
    ),

  delete: protectedProcedure
    .meta(
      openapi({
        summary: "Delete a document folder",
        description:
          "Deletes one of the caller's folders and its icon. Its documents and subfolders move to its parent (or the library root); a subfolder whose name clashes there gets a ` (2)`, ` (3)`… suffix. No document is deleted.",
        tags: ["Documents"],
        method: "DELETE",
      })
    )
    .input(documentFolderInput.delete)
    .output(documentFolderOutput.delete)
    .handler(({ context, input }) =>
      documentFolderHandler.delete({ context, input })
    ),
}
