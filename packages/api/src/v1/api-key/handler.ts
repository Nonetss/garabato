import { auth } from "@nonete/auth"
import type { z } from "zod"
import type { Context } from "#context"
import { toIso, toIsoOrNull } from "#shared/dates"
import type { apiKeyInput } from "#v1/api-key/input"

export const apiKeyHandler = {
  create: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof apiKeyInput.create>
  }) => {
    const apiKey = await auth.api.createApiKey({
      headers: context.headers,
      body: {
        configId: "default",
        name: input.name,
        expiresIn: input.expiresIn,
      },
    })

    return {
      ...apiKey,
      lastRefillAt: toIsoOrNull(apiKey.lastRefillAt),
      lastRequest: toIsoOrNull(apiKey.lastRequest),
      expiresAt: toIsoOrNull(apiKey.expiresAt),
      createdAt: toIso(apiKey.createdAt),
      updatedAt: toIso(apiKey.updatedAt),
    }
  },

  list: async ({ context }: { context: Context }) => {
    const { apiKeys } = await auth.api.listApiKeys({
      headers: context.headers,
    })

    return apiKeys.map((apiKey) => ({
      id: apiKey.id,
      name: apiKey.name,
      start: apiKey.start,
      prefix: apiKey.prefix,
      enabled: apiKey.enabled,
      expiresAt: toIsoOrNull(apiKey.expiresAt),
      createdAt: toIso(apiKey.createdAt),
      updatedAt: toIso(apiKey.updatedAt),
    }))
  },

  delete: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof apiKeyInput.delete>
  }) => {
    const { success } = await auth.api.deleteApiKey({
      headers: context.headers,
      body: { keyId: input.id },
    })

    return { id: input.id, success }
  },

  search: async ({
    context,
    input,
  }: {
    context: Context
    input: z.infer<typeof apiKeyInput.search>
  }) => {
    const { apiKeys } = await auth.api.listApiKeys({
      headers: context.headers,
    })

    const term = input.query.toLowerCase()
    return apiKeys
      .filter((apiKey) => apiKey.name?.toLowerCase().includes(term))
      .slice(0, input.limit)
      .map((apiKey) => ({
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
      }))
  },
}
