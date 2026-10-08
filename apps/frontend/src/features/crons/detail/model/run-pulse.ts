import type { CronRunStatus } from "@/features/crons/shared"

/** The fields of a run the pulse needs; any `listRuns` row satisfies it. */
export interface PulseRun {
  id: string
  status: CronRunStatus
  startedAt: string
  finishedAt: string | null
}

export interface PulseBar {
  id: string
  status: CronRunStatus
  startedAt: string
  durationMs: number | null
  /** Bar height as a percentage of the strip. */
  heightPct: number
}

export interface PulseStats {
  total: number
  counts: Record<CronRunStatus, number>
  /** `success / (success + failed)`; null when neither has happened. */
  successRate: number | null
  /** Consecutive successes from the newest finished run backwards. */
  streak: number
  p50Ms: number | null
  p95Ms: number | null
}

export interface RunPulse {
  /** Oldest to newest, the order the strip draws them. */
  bars: PulseBar[]
  stats: PulseStats
}

const MIN_SUCCESS_BAR_PCT = 14
const SKIPPED_BAR_PCT = 6
const RUNNING_BAR_PCT = 50

function durationMs(run: PulseRun): number | null {
  if (!run.finishedAt) return null
  const ms = Date.parse(run.finishedAt) - Date.parse(run.startedAt)
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}

/** Nearest-rank percentile of an ascending list; null when it is empty. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const rank = Math.ceil(p * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))] ?? null
}

function barHeight(
  status: CronRunStatus,
  ms: number | null,
  scaleMs: number | null
): number {
  if (status === "failed") return 100
  if (status === "skipped") return SKIPPED_BAR_PCT
  if (status === "running") return RUNNING_BAR_PCT
  // Scaled to p95 rather than the max so one slow outlier doesn't flatten
  // every other bar; anything above p95 is clamped to full height.
  if (ms === null || !scaleMs) return MIN_SUCCESS_BAR_PCT
  return Math.min(100, Math.max(MIN_SUCCESS_BAR_PCT, (ms / scaleMs) * 100))
}

/**
 * Builds the pulse strip and its facts from runs ordered newest first (the
 * order `v1.cron.listRuns` returns).
 */
export function buildRunPulse(runs: PulseRun[]): RunPulse {
  const counts: Record<CronRunStatus, number> = {
    running: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  }
  const successDurations: number[] = []
  for (const run of runs) {
    counts[run.status] += 1
    if (run.status !== "success") continue
    const ms = durationMs(run)
    if (ms !== null) successDurations.push(ms)
  }
  successDurations.sort((a, b) => a - b)
  const p50Ms = percentile(successDurations, 0.5)
  const p95Ms = percentile(successDurations, 0.95)

  let streak = 0
  for (const run of runs) {
    if (run.status === "running" && streak === 0) continue
    if (run.status !== "success") break
    streak += 1
  }

  const decided = counts.success + counts.failed
  const bars = runs
    .map((run) => {
      const ms = durationMs(run)
      return {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        durationMs: ms,
        heightPct: barHeight(run.status, ms, p95Ms),
      }
    })
    .reverse()

  return {
    bars,
    stats: {
      total: runs.length,
      counts,
      successRate: decided === 0 ? null : counts.success / decided,
      streak,
      p50Ms,
      p95Ms,
    },
  }
}
