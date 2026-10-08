import type {
  CronCreateInput,
  CronJob,
  CronUpdateInput,
} from "@/features/crons/shared/model/types"
import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { useResourceMutation } from "@/hooks/use-resource-mutation"
import { orpc } from "@/lib/orpc"

const cronsListKey = orpc.v1.cron.list.queryKey()

// `.key()` partial-matches by path + input only, so it invalidates both the
// plain query and the infinite-query cache entry the detail page actually
// reads from (`.queryKey()`/`.infiniteKey()` tag entries with different
// `type`s and would each only match their own variant).
const runsKey = (jobId: string) =>
  orpc.v1.cron.listRuns.key({ input: { jobId } })

const jobKey = (id: string) => orpc.v1.cron.get.queryKey({ input: { id } })

export const useCronCreate = () =>
  useResourceMutation<CronCreateInput, CronJob, CronJob[]>({
    mutationFn: (input) => orpc.v1.cron.create.call(input),
    listKey: cronsListKey,
    messages: {
      success: "Cron creado",
      error: "No se pudo crear el cron",
    },
  })

export const useCronUpdate = () =>
  useResourceMutation<CronUpdateInput, CronJob, CronJob[]>({
    mutationFn: (input) => orpc.v1.cron.update.call(input),
    listKey: cronsListKey,
    extraInvalidate: [],
    messages: {
      success: "Cron actualizado",
      error: "No se pudo actualizar el cron",
    },
  })

export const useCronSetEnabled = (jobId: string) =>
  useResourceMutation<{ id: string; enabled: boolean }, CronJob, CronJob[]>({
    mutationFn: (input) => orpc.v1.cron.setEnabled.call(input),
    listKey: cronsListKey,
    extraInvalidate: [jobKey(jobId)],
    messages: {
      success: "Estado del cron actualizado",
      error: "No se pudo cambiar el estado del cron",
    },
  })

export const useCronRunNow = (jobId: string) =>
  useOrpcMutation<{ id: string }, void>({
    mutationFn: () => orpc.v1.cron.runNow.call({ id: jobId }),
    success: "Ejecución iniciada",
    error: "No se pudo ejecutar el cron",
    invalidate: [jobKey(jobId), runsKey(jobId)],
  })

export const useCronRemove = () =>
  useResourceMutation<{ id: string }, { id: string }, CronJob[]>({
    mutationFn: (input) => orpc.v1.cron.remove.call(input),
    listKey: cronsListKey,
    applyOptimistic: (current, input) =>
      current?.filter((job) => job.id !== input.id),
    messages: {
      success: "Cron eliminado",
      error: "No se pudo eliminar el cron",
    },
  })

export { runsKey as cronRunsKey }
