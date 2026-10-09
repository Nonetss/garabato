import type { SignatureRecord } from "@/features/documents/shared/model/types"
import { formatDateTime, joinFacts } from "@/lib/format"

type TimestampedRecord = Pick<
  SignatureRecord,
  "timestampedAt" | "timestampAuthority"
>

function timestampTime(timestampedAt: string) {
  return formatDateTime(timestampedAt, {
    includeYear: true,
    includeSeconds: true,
  })
}

/** "Sello de tiempo: 09 oct 2026, 12:15:02"; null for a B-B signature. */
export function timestampLine(record: TimestampedRecord): string | null {
  if (record.timestampedAt === null) return null
  return `Sello de tiempo: ${timestampTime(record.timestampedAt)}`
}

/** The detail value: the TSA's time and name, or "Sin sello de tiempo". */
export function timestampDetail(record: TimestampedRecord): string {
  if (record.timestampedAt === null) return "Sin sello de tiempo"
  const time = timestampTime(record.timestampedAt)
  if (record.timestampAuthority === null) return time
  return joinFacts([time, record.timestampAuthority])
}
