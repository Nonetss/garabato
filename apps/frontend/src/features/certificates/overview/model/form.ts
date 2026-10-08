/** A trimmed text, or `undefined` when only whitespace was typed. */
export function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  return trimmed
}

/** The Spanish message the API returned, for showing inside a dialog. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Ha ocurrido un error inesperado"
}
