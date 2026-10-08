import { openapi } from "@orpc/openapi"
import { protectedProcedure } from "#index"
import { collectionHandler } from "#v1/collection/handler"
import { collectionInput } from "#v1/collection/input"
import { collectionOutput } from "#v1/collection/output"

export const collectionRouter = {
  list: protectedProcedure
    .meta(
      openapi({
        summary: "List collections",
        description: "Lists collections owned by the authenticated user.",
        tags: ["Collections"],
        method: "GET",
      })
    )
    .output(collectionOutput.list)
    .handler(({ context }) => collectionHandler.list({ context })),

  create: protectedProcedure
    .meta(
      openapi({
        summary: "Create a collection",
        description:
          "Creates a named custom collection, with an optional description, for the authenticated user.",
        tags: ["Collections"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(collectionInput.create)
    .output(collectionOutput.create)
    .handler(({ context, input }) =>
      collectionHandler.create({ context, input })
    ),

  update: protectedProcedure
    .meta(
      openapi({
        summary: "Update a collection",
        description:
          "Renames a custom collection owned by the authenticated user and sets or clears its description. Built-in collections cannot be changed.",
        tags: ["Collections"],
        method: "PATCH",
      })
    )
    .input(collectionInput.update)
    .output(collectionOutput.update)
    .handler(({ context, input }) =>
      collectionHandler.update({ context, input })
    ),

  delete: protectedProcedure
    .meta(
      openapi({
        summary: "Delete a collection",
        description:
          "Deletes a custom collection owned by the authenticated user and its items. Built-in collections cannot be deleted.",
        tags: ["Collections"],
        method: "DELETE",
      })
    )
    .input(collectionInput.delete)
    .output(collectionOutput.delete)
    .handler(({ context, input }) =>
      collectionHandler.delete({ context, input })
    ),

  listItems: protectedProcedure
    .meta(
      openapi({
        summary: "List collection items",
        description:
          "Lists resources in one of the authenticated user's collections.",
        tags: ["Collections"],
        method: "GET",
      })
    )
    .input(collectionInput.listItems)
    .output(collectionOutput.listItems)
    .handler(({ context, input }) =>
      collectionHandler.listItems({ context, input })
    ),

  updateItem: protectedProcedure
    .meta(
      openapi({
        summary: "Update saved resource metadata",
        description:
          "Replaces the optional display metadata of a resource saved in one of the authenticated user's collections as a whole; omitted metadata clears it.",
        tags: ["Collections"],
        method: "PUT",
      })
    )
    .input(collectionInput.updateItem)
    .output(collectionOutput.updateItem)
    .handler(({ context, input }) =>
      collectionHandler.updateItem({ context, input })
    ),

  addItem: protectedProcedure
    .meta(
      openapi({
        summary: "Add a collection item",
        description:
          "Adds a polymorphic resource to one of the authenticated user's collections. Idempotent: repeating the request returns the existing item with `created: false`.",
        tags: ["Collections"],
        method: "PUT",
      })
    )
    .input(collectionInput.addItem)
    .output(collectionOutput.addItem)
    .handler(({ context, input }) =>
      collectionHandler.addItem({ context, input })
    ),

  removeItem: protectedProcedure
    .meta(
      openapi({
        summary: "Remove a collection item",
        description:
          "Removes a resource from one of the authenticated user's collections. Repeating the request is safe.",
        tags: ["Collections"],
        method: "DELETE",
      })
    )
    .input(collectionInput.removeItem)
    .output(collectionOutput.removeItem)
    .handler(({ context, input }) =>
      collectionHandler.removeItem({ context, input })
    ),

  itemCollections: protectedProcedure
    .meta(
      openapi({
        summary: "List resource collections",
        description:
          "Lists the authenticated user's collections that contain a polymorphic resource.",
        tags: ["Collections"],
        method: "GET",
      })
    )
    .input(collectionInput.itemCollections)
    .output(collectionOutput.itemCollections)
    .handler(({ context, input }) =>
      collectionHandler.itemCollections({ context, input })
    ),

  listFavorites: protectedProcedure
    .meta(
      openapi({
        summary: "List favorites",
        description:
          "Lists resources in the authenticated user's favorites collection, newest first.",
        tags: ["Collections"],
        method: "GET",
      })
    )
    .output(collectionOutput.listFavorites)
    .handler(({ context }) => collectionHandler.listFavorites({ context })),

  addFavorite: protectedProcedure
    .meta(
      openapi({
        summary: "Add a favorite",
        description:
          "Adds a polymorphic resource to the authenticated user's favorites collection. Idempotent: repeating the request returns the existing item with `created: false`.",
        tags: ["Collections"],
        method: "PUT",
      })
    )
    .input(collectionInput.addFavorite)
    .output(collectionOutput.addFavorite)
    .handler(({ context, input }) =>
      collectionHandler.addFavorite({ context, input })
    ),

  removeFavorite: protectedProcedure
    .meta(
      openapi({
        summary: "Remove a favorite",
        description:
          "Removes a resource from the authenticated user's favorites collection. Repeating the request is safe.",
        tags: ["Collections"],
        method: "DELETE",
      })
    )
    .input(collectionInput.removeFavorite)
    .output(collectionOutput.removeFavorite)
    .handler(({ context, input }) =>
      collectionHandler.removeFavorite({ context, input })
    ),

  favoriteStatuses: protectedProcedure
    .meta(
      openapi({
        summary: "Get favorite statuses",
        description:
          "Returns whether each requested resource is in the authenticated user's favorites collection.",
        tags: ["Collections"],
        method: "QUERY",
      })
    )
    .input(collectionInput.favoriteStatuses)
    .output(collectionOutput.favoriteStatuses)
    .handler(({ context, input }) =>
      collectionHandler.favoriteStatuses({ context, input })
    ),
}
