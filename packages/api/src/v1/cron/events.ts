import type { CronRunChange } from "@nonete/cron"
import { MemoryPublisher } from "@orpc/publisher/memory"

type CronRunEvents = { "run-changed": CronRunChange }

type CronRunEventsState = {
  publisher: MemoryPublisher<CronRunEvents>
  /** Aborted on shutdown so open subscriptions end before the HTTP drain. */
  shutdown: AbortController
}

// `bun --hot` re-evaluates this module but keeps the already started
// scheduler, whose `onRunChange` closure holds the first publisher. Keeping
// the state on globalThis (same realm across reloads) stops the scheduler and
// new subscribers from ending up on different publishers.
declare global {
  var __cronRunEvents: CronRunEventsState | undefined
}

function createState(): CronRunEventsState {
  const existing = globalThis.__cronRunEvents
  if (existing) return existing
  const created: CronRunEventsState = {
    // In memory: the scheduler is single-instance, so every run is published
    // by the same process its subscribers are connected to.
    publisher: new MemoryPublisher<CronRunEvents>(),
    shutdown: new AbortController(),
  }
  globalThis.__cronRunEvents = created
  return created
}

const state = createState()

/** Wired to the scheduler's `onRunChange` by the backend. */
export function publishCronRunChange(change: CronRunChange): Promise<void> {
  return state.publisher.publish("run-changed", change)
}

/**
 * Signal that ends a subscription when the caller goes away or the backend
 * shuts down, whichever comes first.
 */
export function cronRunEventsSignal(signal: AbortSignal | undefined) {
  if (!signal) return state.shutdown.signal
  return AbortSignal.any([signal, state.shutdown.signal])
}

/**
 * Every run change of every job, from the moment of the call. The iterator
 * throws the abort reason once `signal` aborts.
 */
export function subscribeCronRunChanges(signal: AbortSignal) {
  return state.publisher.subscribe("run-changed", { signal })
}

/** Ends every open subscription. Called by the backend's shutdown. */
export function closeCronRunEvents(): void {
  state.shutdown.abort()
}
