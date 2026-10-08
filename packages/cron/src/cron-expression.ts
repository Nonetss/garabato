import { CronValidationError } from "#errors"

/**
 * Bun.cron schedules and parses in UTC only (no timezone option).
 * The `timezone` column is kept for forward-compat; non-UTC is rejected.
 */
export function assertValidCronExpression(
  expression: string,
  timezone = "UTC"
): void {
  if (timezone.toUpperCase() !== "UTC") {
    throw new CronValidationError(
      `Timezone "${timezone}" is not supported; Bun.cron runs in UTC only`
    )
  }

  try {
    Bun.cron.parse(expression)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new CronValidationError(
      `Invalid cron expression "${expression}": ${message}`
    )
  }
}

export function nextRunAt(expression: string, from?: Date): Date | null {
  return Bun.cron.parse(expression, from ?? Date.now())
}
