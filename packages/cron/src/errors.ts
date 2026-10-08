export class CronValidationError extends Error {
  readonly name = "CronValidationError"
}

export class CronNotFoundError extends Error {
  readonly name = "CronNotFoundError"
}

/** A `code` job is owned by its procedure's `cron.schedule` meta. */
export class CronReadOnlyError extends Error {
  readonly name = "CronReadOnlyError"
}

/** Postgres unique_violation (23505), raised directly or wrapped as `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown) =>
    typeof value === "object" && value !== null && "code" in value
      ? (value as { code: unknown }).code
      : undefined

  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause: unknown }).cause
      : undefined

  return codeOf(error) === "23505" || codeOf(cause) === "23505"
}
