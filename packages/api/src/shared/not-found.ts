import { errors } from "#errors"

export function assertFound<T>(row: T | null | undefined, message?: string): T {
  if (row) return row
  throw message ? errors.NOT_FOUND({ message }) : errors.NOT_FOUND()
}
