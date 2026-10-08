import type { CronService } from "@nonete/cron"

let bound: CronService | null = null

/** Wire the backend CronService (with scheduler onChange) into the API layer. */
export function bindCronService(service: CronService): void {
  bound = service
}

export function getCronService(): CronService {
  if (!bound) {
    throw new Error(
      "CronService not bound — call bindCronService() during backend startup"
    )
  }
  return bound
}
