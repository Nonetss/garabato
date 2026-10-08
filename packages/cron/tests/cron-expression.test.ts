import { describe, expect, test } from "bun:test"

import { assertValidCronExpression, nextRunAt } from "#cron-expression"
import { CronValidationError } from "#errors"

describe("assertValidCronExpression", () => {
  test("accepts a valid expression in UTC, in any case", () => {
    expect(() => assertValidCronExpression("0 3 * * *")).not.toThrow()
    expect(() => assertValidCronExpression("@hourly", "utc")).not.toThrow()
  })

  test("rejects an invalid expression", () => {
    expect(() => assertValidCronExpression("not a cron")).toThrow(
      CronValidationError
    )
  })

  test("rejects a non-UTC timezone", () => {
    expect(() =>
      assertValidCronExpression("0 * * * *", "Europe/Madrid")
    ).toThrow(CronValidationError)
  })
})

describe("nextRunAt", () => {
  test("returns the next fire after the given date", () => {
    const from = new Date("2026-01-01T00:00:00.000Z")
    expect(nextRunAt("0 3 * * *", from)).toEqual(
      new Date("2026-01-01T03:00:00.000Z")
    )
  })
})
