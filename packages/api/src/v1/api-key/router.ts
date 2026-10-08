import { openapi } from "@orpc/openapi"
import { adminProcedure } from "#index"
import { apiKeyHandler } from "#v1/api-key/handler"
import { apiKeyInput } from "#v1/api-key/input"
import { apiKeyOutput } from "#v1/api-key/output"

export const apiKeyRouter = {
  create: adminProcedure
    .meta(
      openapi({
        summary: "Create an API key",
        description:
          "Creates a new API key for the authenticated user. The plaintext key is returned exactly once in the response, alongside the key's metadata; store it immediately because it cannot be retrieved later.",
        tags: ["Admin - API Keys", "Admin"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(apiKeyInput.create)
    .output(apiKeyOutput.create)
    .handler(({ context, input }) => {
      return apiKeyHandler.create({ context, input })
    }),

  list: adminProcedure
    .meta(
      openapi({
        summary: "List API keys",
        description: "Lists the API keys owned by the authenticated user.",
        tags: ["Admin - API Keys", "Admin"],
        method: "GET",
      })
    )
    .output(apiKeyOutput.list)
    .handler(({ context }) => {
      return apiKeyHandler.list({ context })
    }),

  delete: adminProcedure
    .meta(
      openapi({
        summary: "Delete an API key",
        description: "Deletes an API key owned by the authenticated user.",
        tags: ["Admin - API Keys", "Admin"],
        method: "DELETE",
      })
    )
    .input(apiKeyInput.delete)
    .output(apiKeyOutput.delete)
    .handler(({ context, input }) => {
      return apiKeyHandler.delete({ context, input })
    }),

  search: adminProcedure
    .meta(
      openapi({
        summary: "Search API keys",
        description:
          "Type-ahead search over the authenticated user's own API keys by name, for suggestion-style pickers. Returns a small, unpaginated list.",
        tags: ["Admin - API Keys", "Admin"],
        method: "GET",
      })
    )
    .input(apiKeyInput.search)
    .output(apiKeyOutput.search)
    .handler(({ context, input }) => {
      return apiKeyHandler.search({ context, input })
    }),
}
