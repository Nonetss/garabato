import { spyOn } from "bun:test"

type CronSchedule = Parameters<typeof Bun.cron.parse>[0]
type CronHandler = (this: Bun.CronJob) => unknown

/** A job the scheduler registered through `Bun.cron`, fired by hand. */
export type FakeCronJob = {
  expression: string
  fire: () => Promise<unknown>
  isStopped: () => boolean
}

/**
 * Replaces in-process `Bun.cron` scheduling with a recorder so no timer
 * fires, keeping the real `parse` that `nextRunAt` uses. Call `restore` in
 * `afterEach`.
 */
export function installFakeBunCron() {
  const jobs: FakeCronJob[] = []

  function register(expression: string, handler: CronHandler): Bun.CronJob {
    let stopped = false
    const handle: Bun.CronJob = {
      cron: expression,
      stop() {
        stopped = true
        return handle
      },
      ref: () => handle,
      unref: () => handle,
      [Symbol.dispose]() {
        stopped = true
      },
    }
    jobs.push({
      expression,
      fire: async () => handler.call(handle),
      isStopped: () => stopped,
    })
    return handle
  }

  function fakeCron(
    schedule: CronSchedule,
    handler: CronHandler,
    options?: Bun.CronOptions
  ): Bun.CronJob
  function fakeCron(
    path: string,
    schedule: CronSchedule,
    title: string
  ): Promise<void>
  function fakeCron(
    first: string,
    second: CronHandler | CronSchedule
  ): Bun.CronJob | Promise<void> {
    if (typeof second !== "function") {
      return Promise.reject(new Error("OS-level Bun.cron is not faked"))
    }
    return register(first, second)
  }

  const { parse, remove } = Bun.cron
  const spy = spyOn(Bun, "cron").mockImplementation(
    Object.assign(fakeCron, { parse, remove })
  )
  // The spy replaces `Bun.cron` itself, so its static helpers go back on it.
  Bun.cron.parse = parse
  Bun.cron.remove = remove

  return {
    jobs,
    /** Jobs registered and not stopped since. */
    active: () => jobs.filter((job) => !job.isStopped()),
    restore: () => spy.mockRestore(),
  }
}
