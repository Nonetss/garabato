import pino from "pino"

/** A real pino logger that writes nothing, for the scheduler and sync. */
export function silentLogger() {
  return pino({ level: "silent" })
}
