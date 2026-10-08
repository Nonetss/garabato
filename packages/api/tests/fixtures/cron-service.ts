import { mock } from "bun:test"
import type { CronService } from "@nonete/cron"

import { bindCronService } from "#v1/cron/runtime"

function notConfigured(method: string) {
  return () =>
    Promise.reject(
      new Error(`fake cron service: "${method}" has no implementation`)
    )
}

/**
 * The cron service the handlers reach through `getCronService()`, bound once
 * through the same `bindCronService` the backend calls at startup. Every
 * method rejects until a test gives it an implementation; call
 * `resetCronService()` in `beforeEach`.
 */
export const cronService = {
  list: mock<CronService["list"]>(notConfigured("list")),
  get: mock<CronService["get"]>(notConfigured("get")),
  create: mock<CronService["create"]>(notConfigured("create")),
  update: mock<CronService["update"]>(notConfigured("update")),
  setEnabled: mock<CronService["setEnabled"]>(notConfigured("setEnabled")),
  remove: mock<CronService["remove"]>(notConfigured("remove")),
  listRuns: mock<CronService["listRuns"]>(notConfigured("listRuns")),
  getRun: mock<CronService["getRun"]>(notConfigured("getRun")),
  runNow: mock<CronService["runNow"]>(notConfigured("runNow")),
} satisfies CronService

bindCronService(cronService)

export function resetCronService() {
  for (const [method, fn] of Object.entries(cronService)) {
    fn.mockReset()
    fn.mockImplementation(notConfigured(method))
  }
}
