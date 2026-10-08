import type { db } from "#index"

/**
 * Test-only stand-in for the shared Drizzle `db`. Any Drizzle call chain is
 * accepted; awaiting it records the call and resolves the next result the
 * test queued for the chain's operation. It never opens a connection or
 * builds SQL, so it checks what the code reads and writes, not the query.
 */

export type Db = typeof db

/**
 * The root of a chain: `query.<table>.findFirst` / `findMany` for the
 * relational API, or the builder method that starts it.
 */
export type FakeDbOp =
  | `query.${string}.findFirst`
  | `query.${string}.findMany`
  | "select"
  | "insert"
  | "update"
  | "delete"

export type FakeDbStep = { method: string; args: unknown[] }

export type FakeDbCall = { op: FakeDbOp; steps: FakeDbStep[] }

export type FakeDb = {
  /** The fake, typed as the real `db` so it can be injected or mocked in. */
  db: Db
  /** Results returned, in order, to the next awaited chains of `op`. */
  queue: (op: FakeDbOp, ...results: unknown[]) => void
  /** Makes the next awaited chain of `op` reject with `error`. */
  queueError: (op: FakeDbOp, error: unknown) => void
  /** Every awaited chain, optionally only those of one operation. */
  calls: (op?: FakeDbOp) => FakeDbCall[]
  /** Clears queued results and recorded calls. */
  reset: () => void
}

const BUILDER_OPS = ["select", "insert", "update", "delete"] as const

function isBuilderOp(prop: string): prop is (typeof BUILDER_OPS)[number] {
  return BUILDER_OPS.some((op) => op === prop)
}

/** The arguments of the first `method` step in a recorded call. */
export function stepArgs(call: FakeDbCall, method: string): unknown[] {
  const step = call.steps.find((candidate) => candidate.method === method)
  if (!step) {
    throw new Error(`fake db: "${call.op}" call has no "${method}" step`)
  }
  return step.args
}

type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown }

export function createFakeDb(): FakeDb {
  const queues = new Map<FakeDbOp, Outcome[]>()
  const recorded: FakeDbCall[] = []

  const enqueue = (op: FakeDbOp, outcomes: Outcome[]) => {
    const queued = queues.get(op) ?? []
    queued.push(...outcomes)
    queues.set(op, queued)
  }

  const settle = (call: FakeDbCall): Promise<unknown> => {
    recorded.push(call)
    const outcome = queues.get(call.op)?.shift()
    if (!outcome) {
      return Promise.reject(
        new Error(`fake db: no result queued for "${call.op}"`)
      )
    }
    if (!outcome.ok) return Promise.reject(outcome.error)
    return Promise.resolve(outcome.value)
  }

  // A thenable that grows with each chained method and settles once awaited.
  const chain = (op: FakeDbOp, steps: FakeDbStep[]): object =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop !== "string") return undefined
          if (prop === "then") {
            return (
              onFulfilled: (value: unknown) => unknown,
              onRejected: (reason: unknown) => unknown
            ) => settle({ op, steps }).then(onFulfilled, onRejected)
          }
          return (...args: unknown[]) =>
            chain(op, [...steps, { method: prop, args }])
        },
      }
    )

  const query = new Proxy(
    {},
    {
      get(_, table) {
        if (typeof table !== "string") return undefined
        return {
          findFirst: (...args: unknown[]) =>
            chain(`query.${table}.findFirst`, [{ method: "findFirst", args }]),
          findMany: (...args: unknown[]) =>
            chain(`query.${table}.findMany`, [{ method: "findMany", args }]),
        }
      },
    }
  )

  const root: object = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "query") return query
        // A transaction runs its callback against the same fake, so its
        // chains are queued and recorded like any other.
        if (prop === "transaction") {
          return (callback: (tx: object) => unknown) => callback(root)
        }
        if (typeof prop !== "string" || !isBuilderOp(prop)) return undefined
        return (...args: unknown[]) => chain(prop, [{ method: prop, args }])
      },
    }
  )

  return {
    // The one cast in the test support: a Proxy can't structurally satisfy
    // Drizzle's database type, and the code under test only reaches it
    // through the chains handled above.
    db: root as Db,
    queue(op, ...results) {
      enqueue(
        op,
        results.map((value) => ({ ok: true, value }))
      )
    },
    queueError(op, error) {
      enqueue(op, [{ ok: false, error }])
    },
    calls(op) {
      if (op === undefined) return [...recorded]
      return recorded.filter((call) => call.op === op)
    },
    reset() {
      queues.clear()
      recorded.length = 0
    },
  }
}
