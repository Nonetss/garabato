import type { AnyProcedureContract } from "@orpc/contract"
import { getOpenAPIMeta } from "@orpc/openapi"
import { ZodToJsonSchemaConverter } from "@orpc/zod"

const jsonSchemaConverter = new ZodToJsonSchemaConverter()

export type ProcedureDocs = {
  summary: string | undefined
  description: string | undefined
  tags: string[]
}

/** Summary, description and tags declared in the procedure's `openapi()` meta. */
export function procedureDocs(procedure: AnyProcedureContract): ProcedureDocs {
  const route = getOpenAPIMeta(procedure)
  if (route === undefined) {
    return { summary: undefined, description: undefined, tags: [] }
  }

  const tags: string[] = []
  if (route.tags !== undefined) tags.push(...route.tags)

  return { summary: route.summary, description: route.description, tags }
}

/**
 * JSON Schema of the procedure's input, or null when it takes none or its
 * schema can't be converted. oRPC v2 stacks `.input()` calls; every procedure
 * here declares at most one.
 */
export function procedureInputJsonSchema(
  procedure: AnyProcedureContract
): Record<string, unknown> | null {
  const inputSchemas = procedure["~orpc"].inputSchemas
  if (inputSchemas === undefined) return null

  const [inputSchema] = inputSchemas
  if (inputSchema === undefined) return null

  try {
    const [jsonSchema] = jsonSchemaConverter.convert(inputSchema, "input")
    // `true` and `false` are valid JSON Schemas but describe no fields.
    if (typeof jsonSchema === "boolean") return null
    return jsonSchema
  } catch {
    return null
  }
}
