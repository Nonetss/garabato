import { z } from "zod"

const apiKeyListItem = z.object({
  id: z.string().describe("The unique identifier for the API key"),
  name: z.string().nullable().describe("The name of the API key"),
  start: z
    .string()
    .nullable()
    .describe("The start timestamp of the API key, if any"),
  prefix: z.string().nullable().describe("The prefix of the API key, if any"),
  enabled: z.boolean().describe("Whether the API key is enabled"),
  expiresAt: z
    .string()
    .nullable()
    .describe("The expiration date of the API key"),
  createdAt: z.string().describe("The date and time the API key was created"),
  updatedAt: z.string().describe("The date and time the API key was updated"),
})

const apiKeySearchItem = z.object({
  id: z.string().describe("The unique identifier for the API key"),
  name: z.string().nullable().describe("The name of the API key"),
  prefix: z.string().nullable().describe("The prefix of the API key, if any"),
})

export const apiKeyOutput = {
  list: z.array(apiKeyListItem).describe("The API keys owned by the user"),
  search: z
    .array(apiKeySearchItem)
    .describe("API keys owned by the user matching the search term"),
  delete: z.object({
    id: z.string().describe("The id of the deleted API key"),
    success: z.boolean().describe("Whether the API key was deleted"),
  }),
  create: z.object({
    configId: z.string().describe("The configuration ID"),
    name: z.string().nullable().describe("The name of the API key"),
    start: z
      .string()
      .nullable()
      .describe("The start timestamp of the API key, if any"),
    referenceId: z
      .string()
      .describe("The reference ID associated with this API key"),
    prefix: z.string().nullable().describe("The prefix of the API key, if any"),
    key: z.string().describe("The API key itself"),
    refillInterval: z
      .number()
      .nullable()
      .describe("The interval (ms) for rate limit refills, if any"),
    refillAmount: z
      .number()
      .nullable()
      .describe("The amount to refill per interval, if any"),
    lastRefillAt: z
      .string()
      .nullable()
      .describe("Last time rate limit was refilled"),
    enabled: z.boolean().describe("Whether the API key is enabled"),
    rateLimitEnabled: z
      .boolean()
      .describe("Whether rate limiting is enabled for this API key"),
    rateLimitTimeWindow: z
      .number()
      .nullable()
      .describe("Time window in ms for rate limiting"),
    rateLimitMax: z
      .number()
      .nullable()
      .describe("Maximum allowed requests in the time window"),
    requestCount: z
      .number()
      .describe("Current request count for this time window"),
    remaining: z
      .number()
      .nullable()
      .describe("Number of requests remaining in window, if tracked"),
    lastRequest: z
      .string()
      .nullable()
      .describe("Time of the last request, if any"),
    expiresAt: z
      .string()
      .nullable()
      .describe("The expiration date of the API key"),
    createdAt: z.string().describe("The date and time the API key was created"),
    updatedAt: z.string().describe("The date and time the API key was updated"),
    permissions: z.any().nullable().describe("Permissions object, if any"),
    metadata: z
      .any()
      .nullable()
      .describe("Metadata associated with the API key, if any"),
    id: z.string().describe("The unique identifier for the API key"),
  }),
}
