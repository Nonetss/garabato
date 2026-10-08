import { CronDetailContent } from "@/features/crons/detail/components/cron-detail-content"
import { QueryProvider } from "@/providers/query-provider"

export function CronDetailPage({ jobId }: { jobId: string }) {
  return (
    <QueryProvider>
      <CronDetailContent jobId={jobId} />
    </QueryProvider>
  )
}
