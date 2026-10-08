import type { CronRunStatus } from "@/features/crons/shared/model/types"

export const cronRunStatusLabels: Record<CronRunStatus, string> = {
  running: "En curso",
  success: "Correcto",
  failed: "Fallido",
  skipped: "Omitido",
}

export const cronLabels = {
  handler: "Acción",
  handlerUnavailable: "Acción no disponible",
  handlerUnavailableHint:
    "Esta tarea apunta a una acción que ya no está disponible. Elige otra acción o corrige la clave.",
  selectHandler: "Selecciona una acción",
  untaggedHandlers: "Sin tag",
  runsAs: "Se ejecuta como",
  runsAsNobody: "Sin usuario",
  runsAsHint:
    "El job se ejecutará con los permisos de este usuario. Sin usuario, solo puede llamar a endpoints exclusivos de cron.",
  runsAsDefaultsToCallerHint:
    "Si no eliges a nadie, el job se ejecutará con tus propios permisos.",
  runsAsSearchPlaceholder: "Buscar por nombre o email...",
  runsAsNoResults: "Sin resultados",
  runsAsClear: "Quitar usuario",
  payload: "Parámetros",
  payloadHint: "Estos campos dependen de la acción seleccionada.",
  declaredInCode:
    "Programado desde el código. No se puede editar, pausar, eliminar ni ejecutar a mano.",
  runNow: "Ejecutar ahora",
  runNowPending: "Ejecutando...",
  create: "Nuevo cron",
  edit: "Editar",
  delete: "Eliminar",
  deleteTitle: "Eliminar cron",
  deleteDescription: (name: string) =>
    `Se eliminará "${name}" y su historial de ejecuciones. Esta acción no se puede deshacer.`,
} as const
