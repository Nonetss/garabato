import type { CronJob } from "@/features/crons/shared"
import { cronLabels } from "@/features/crons/shared"

/** The first tag of the job's procedure, or the "untagged" bucket label. */
export function jobTag(job: CronJob) {
  return job.tags[0] ?? cronLabels.untaggedHandlers
}

export function availableTags(jobs: CronJob[]) {
  const tags = new Set(jobs.map(jobTag))
  return [...tags].sort((a, b) => {
    if (a === cronLabels.untaggedHandlers) return 1
    if (b === cronLabels.untaggedHandlers) return -1
    return a.localeCompare(b, "es")
  })
}

export function groupJobsByTag(jobs: CronJob[]) {
  const groups = new Map<string, CronJob[]>()

  for (const job of jobs) {
    const tag = jobTag(job)
    const existing = groups.get(tag)
    if (existing) {
      existing.push(job)
    } else {
      groups.set(tag, [job])
    }
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === cronLabels.untaggedHandlers) return 1
    if (b === cronLabels.untaggedHandlers) return -1
    return a.localeCompare(b, "es")
  })
}
