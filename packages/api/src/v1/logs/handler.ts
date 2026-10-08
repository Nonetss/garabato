import { env } from "@nonete/env/server"
import type { z } from "zod"

import { errors } from "#errors"
import { paginate } from "#shared/pagination"
import type { logsInput } from "#v1/logs/input"
import type { logsOutput } from "#v1/logs/output"

const pinoLevelLabel: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
}

type LogEntry = z.infer<typeof logsOutput.query>["entries"][number]
type LogsQueryInput = z.infer<typeof logsInput.query>

interface LokiQueryRangeResponse {
  data: {
    result: Array<{
      stream: Record<string, string>
      values: [string, string][]
    }>
  }
}

// LogQL requires backtick or double-quote string literals to be escaped by
// hand here — no query-builder dependency: @sigyn/logql's composed
// LogQL.toString() always renders `| json` after label filters (never
// before), which would put our type/userId/path filters ahead of the JSON
// parse stage that produces those fields; @openally/loki additionally
// crashes at import time under Bun, whose built-in "undici" shim doesn't
// implement Agent.prototype.compose(), which @openally/httpie calls at
// module load. See openspec/changes/add-activity-log (archived) for the
// original design and this handler's git history for both dead ends.
function escapeLogQLString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildLogQL(input: LogsQueryInput): string {
  let query =
    '{service=~"nonete-backend|nonete-frontend"} | json | type=~"page_view|api_call"'
  if (input.type) query += ` | type="${escapeLogQLString(input.type)}"`
  if (input.userId) query += ` | userId="${escapeLogQLString(input.userId)}"`
  if (input.method) query += ` | method="${escapeLogQLString(input.method)}"`
  if (input.path) query += ` | path=~".*${escapeRegex(input.path)}.*"`
  return query
}

function resolveTimeRange(input: LogsQueryInput): {
  start: string
  end: string
} {
  const now = Date.now()
  return {
    start: input.from ?? new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end: input.before ?? input.to ?? new Date(now).toISOString(),
  }
}

async function fetchLokiRange(
  input: LogsQueryInput
): Promise<LokiQueryRangeResponse> {
  const { start, end } = resolveTimeRange(input)

  const url = new URL("/loki/api/v1/query_range", env.LOKI_URL)
  url.searchParams.set("query", buildLogQL(input))
  url.searchParams.set("start", start)
  url.searchParams.set("end", end)
  url.searchParams.set("limit", String(input.limit + 1))
  url.searchParams.set("direction", "backward")

  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw errors.BAD_GATEWAY({
      message: `No se pudo contactar con Loki en ${env.LOKI_URL}`,
    })
  }
  if (!response.ok) {
    throw errors.BAD_GATEWAY({
      message: `Loki respondió ${response.status} a la consulta`,
    })
  }

  return response.json() as Promise<LokiQueryRangeResponse>
}

function resolveLevel(level: unknown): string {
  if (typeof level === "number") return pinoLevelLabel[level] ?? String(level)
  return String(level ?? "info")
}

/** `ts` is Loki's own stream timestamp (nanoseconds), not derived from the
 * pino line — that's what makes it a valid pagination cursor. */
function parseLogEntry(ts: bigint, line: string): LogEntry | undefined {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  return {
    timestamp: new Date(Number(ts / 1_000_000n)).toISOString(),
    level: resolveLevel(parsed.level),
    service: typeof parsed.service === "string" ? parsed.service : "",
    type: parsed.type as "page_view" | "api_call",
    message: typeof parsed.msg === "string" ? parsed.msg : "",
    userId: typeof parsed.userId === "string" ? parsed.userId : null,
    path: typeof parsed.path === "string" ? parsed.path : null,
    method: typeof parsed.method === "string" ? parsed.method : null,
    statusCode: typeof parsed.status === "number" ? parsed.status : null,
    raw: parsed,
  }
}

export const logsHandler = {
  query: async ({
    input,
  }: {
    input: LogsQueryInput
  }): Promise<z.infer<typeof logsOutput.query>> => {
    // Unset LOKI_URL is a supported configuration, not an error — see
    // "Logging degrades gracefully without Loki configured" in
    // openspec/specs/activity-log/spec.md.
    if (!env.LOKI_URL) {
      return { entries: [], nextCursor: null }
    }

    const body = await fetchLokiRange(input)

    const rows = body.data.result
      .flatMap(({ values }) =>
        values.map(([ts, line]) => ({ ts: BigInt(ts), line }))
      )
      .sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0))

    const { page, hasMore } = paginate(rows, input.limit)

    const entries = page
      .map(({ ts, line }) => parseLogEntry(ts, line))
      .filter((entry): entry is LogEntry => entry !== undefined)

    const nextCursor = hasMore ? (entries.at(-1)?.timestamp ?? null) : null

    return { entries, nextCursor }
  },
}
