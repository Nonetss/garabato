import { describe, expect, test } from "bun:test"
import { call } from "@orpc/server"

import { protectedProcedure } from "#index"
import { adminContext, userContext } from "#tests/fixtures/context"
import { expectErrorCode } from "#tests/fixtures/errors"
import {
  createOperationLimiter,
  operationLimit,
} from "#v1/document/operation-limit"

const WINDOW_MS = 60_000

function limiterAt(clock: { now: number }, maxStarts = 30) {
  return createOperationLimiter({
    maxConcurrent: 2,
    maxStarts,
    windowMs: WINDOW_MS,
    now: () => clock.now,
  })
}

describe("createOperationLimiter", () => {
  test("allows up to the concurrency bound and refuses the next", () => {
    const limiter = limiterAt({ now: 0 })

    expect(limiter.tryAcquire("ada")).not.toBeNull()
    expect(limiter.tryAcquire("ada")).not.toBeNull()
    expect(limiter.tryAcquire("ada")).toBeNull()
  })

  test("frees a slot on release", () => {
    const limiter = limiterAt({ now: 0 })
    const first = limiter.tryAcquire("ada")
    limiter.tryAcquire("ada")

    first?.()

    expect(limiter.tryAcquire("ada")).not.toBeNull()
  })

  test("releasing twice frees only one slot", () => {
    const limiter = limiterAt({ now: 0 })
    const first = limiter.tryAcquire("ada")
    limiter.tryAcquire("ada")

    first?.()
    first?.()

    expect(limiter.tryAcquire("ada")).not.toBeNull()
    expect(limiter.tryAcquire("ada")).toBeNull()
  })

  test("refuses starts over the window bound until the oldest ages out", () => {
    const clock = { now: 0 }
    const limiter = limiterAt(clock, 3)
    for (let i = 0; i < 3; i++) {
      clock.now = i * 1_000
      limiter.tryAcquire("ada")?.()
    }

    clock.now = WINDOW_MS - 1
    expect(limiter.tryAcquire("ada")).toBeNull()

    clock.now = WINDOW_MS + 1
    expect(limiter.tryAcquire("ada")).not.toBeNull()
  })

  test("does not count refused calls towards the window", () => {
    const limiter = limiterAt({ now: 0 }, 3)
    const first = limiter.tryAcquire("ada")
    const second = limiter.tryAcquire("ada")
    // Refused by concurrency: these must not use up the window.
    expect(limiter.tryAcquire("ada")).toBeNull()
    expect(limiter.tryAcquire("ada")).toBeNull()
    first?.()
    second?.()

    // Third start of three still fits, the fourth does not.
    const third = limiter.tryAcquire("ada")
    expect(third).not.toBeNull()
    third?.()
    expect(limiter.tryAcquire("ada")).toBeNull()
  })

  test("keeps users apart", () => {
    const limiter = limiterAt({ now: 0 })
    limiter.tryAcquire("ada")
    limiter.tryAcquire("ada")

    expect(limiter.tryAcquire("ada")).toBeNull()
    expect(limiter.tryAcquire("grace")).not.toBeNull()
  })

  test("drops idle users once their window is empty", () => {
    const clock = { now: 0 }
    const limiter = limiterAt(clock)
    limiter.tryAcquire("ada")?.()
    expect(limiter.trackedUsers()).toBe(1)

    clock.now = WINDOW_MS + 1

    expect(limiter.trackedUsers()).toBe(0)
  })
})

/** A procedure that runs until the test resolves or rejects it. */
function gatedProcedure(limiter: ReturnType<typeof createOperationLimiter>) {
  const gates: { resolve: () => void; reject: (error: Error) => void }[] = []
  const procedure = protectedProcedure.use(operationLimit(limiter)).handler(
    () =>
      new Promise<string>((resolve, reject) => {
        gates.push({ resolve: () => resolve("done"), reject })
      })
  )
  return { procedure, gates }
}

describe("operationLimit", () => {
  test("answers TOO_MANY_REQUESTS over the bound, before the handler runs", async () => {
    const { procedure, gates } = gatedProcedure(limiterAt({ now: 0 }))
    const context = userContext()

    const first = call(procedure, undefined, { context })
    const second = call(procedure, undefined, { context })
    await Promise.resolve()

    await expectErrorCode(
      call(procedure, undefined, { context }),
      "TOO_MANY_REQUESTS"
    )
    await Bun.sleep(0)
    expect(gates).toHaveLength(2)

    for (const gate of gates) gate.resolve()
    expect(await first).toBe("done")
    expect(await second).toBe("done")
  })

  test("frees the slot when the procedure fails", async () => {
    const { procedure, gates } = gatedProcedure(limiterAt({ now: 0 }))
    const context = userContext()

    const failing = call(procedure, undefined, { context })
    const running = call(procedure, undefined, { context })
    await Bun.sleep(0)
    gates[0]?.reject(new Error("boom"))
    await expect(failing).rejects.toThrow()

    const next = call(procedure, undefined, { context })
    await Bun.sleep(0)
    expect(gates).toHaveLength(3)

    gates[1]?.resolve()
    gates[2]?.resolve()
    expect(await running).toBe("done")
    expect(await next).toBe("done")
  })

  test("limits each user separately", async () => {
    const { procedure, gates } = gatedProcedure(limiterAt({ now: 0 }))
    const user = userContext()

    const first = call(procedure, undefined, { context: user })
    const second = call(procedure, undefined, { context: user })
    const other = call(procedure, undefined, { context: adminContext() })
    await Bun.sleep(0)

    expect(gates).toHaveLength(3)
    for (const gate of gates) gate.resolve()
    await Promise.all([first, second, other])
  })
})
