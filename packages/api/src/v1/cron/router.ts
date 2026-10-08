import { openapi } from "@orpc/openapi"
import { adminProcedure, protectedProcedure } from "#index"
import { cronHandler } from "#v1/cron/handler"
import { cronInput } from "#v1/cron/input"
import { cronOutput } from "#v1/cron/output"

export const cronRouter = {
  list: protectedProcedure
    .meta(
      openapi({
        summary: "List cron jobs",
        description:
          "Lists every persistent cron job definition (name, schedule, enabled flag, last/next run).",
        tags: ["System - Cron", "System"],
        method: "GET",
      })
    )
    .output(cronOutput.list)
    .handler(() => cronHandler.list()),

  get: protectedProcedure
    .meta(
      openapi({
        summary: "Get cron job",
        description: "Returns a single cron job by id.",
        tags: ["System - Cron", "System"],
        method: "GET",
      })
    )
    .input(cronInput.get)
    .output(cronOutput.job)
    .handler(({ input }) => cronHandler.get({ input })),

  create: adminProcedure
    .meta(
      openapi({
        summary: "Create a cron job",
        description:
          "Creates a persistent cron job. The handler key must be a discoverable cron-eligible procedure. Timezone is always UTC. The job runs with the permissions of `userId`, which defaults to the caller.",
        tags: ["System - Cron", "System"],
        method: "POST",
        successStatus: 201,
      })
    )
    .input(cronInput.create)
    .output(cronOutput.job)
    .handler(({ context, input }) => cronHandler.create({ context, input })),

  setEnabled: adminProcedure
    .meta(
      openapi({
        summary: "Enable or disable a cron job",
        description:
          "Toggles whether the job is scheduled. Disabling unschedules it immediately; enabling recomputes nextRunAt and schedules it.",
        tags: ["System - Cron", "System"],
        method: "PATCH",
      })
    )
    .input(cronInput.setEnabled)
    .output(cronOutput.job)
    .handler(({ input }) => cronHandler.setEnabled({ input })),

  update: adminProcedure
    .meta(
      openapi({
        summary: "Update a cron job",
        description:
          "Updates name, description, cron expression, handler key, owning user, and/or payload. Changing the expression refreshes nextRunAt and reschedules the job. Timezone is not editable via this endpoint.",
        tags: ["System - Cron", "System"],
        method: "PATCH",
      })
    )
    .input(cronInput.update)
    .output(cronOutput.job)
    .handler(({ input }) => cronHandler.update({ input })),

  remove: adminProcedure
    .meta(
      openapi({
        summary: "Delete a cron job",
        description:
          "Soft-deletes a cron job: it's disabled, unscheduled immediately, and hidden from list/get, but the job row and its run history are kept in the database.",
        tags: ["System - Cron", "System"],
        method: "DELETE",
      })
    )
    .input(cronInput.remove)
    .output(cronOutput.removed)
    .handler(({ input }) => cronHandler.remove({ input })),

  runNow: adminProcedure
    .meta(
      openapi({
        summary: "Manually trigger a cron job",
        description:
          "Runs a cron job immediately, outside its schedule, regardless of its enabled flag. Fails if a run is already in progress. Returns the created run row; execution continues in the background.",
        tags: ["System - Cron", "System"],
        method: "POST",
      })
    )
    .input(cronInput.runNow)
    .output(cronOutput.run)
    .handler(({ input }) => cronHandler.runNow({ input })),

  listRuns: protectedProcedure
    .meta(
      openapi({
        summary: "List cron run history",
        description:
          "Returns a page of execution history for a cron job (status, timestamps, optional error), newest first. Pass the previous response's nextCursor to fetch the next page.",
        tags: ["System - Cron", "System"],
        method: "GET",
      })
    )
    .input(cronInput.listRuns)
    .output(cronOutput.runs)
    .handler(({ input }) => cronHandler.listRuns({ input })),

  handlers: protectedProcedure
    .meta(
      openapi({
        summary: "List discoverable cron handlers",
        description:
          "Returns every cron-eligible oRPC procedure (key, summary, description, input JSON Schema) derived from the versioned router.",
        tags: ["System - Cron", "System"],
        method: "GET",
      })
    )
    .output(cronOutput.handlers)
    .handler(() => cronHandler.handlers()),

  // Not cron-eligible: it only exists to keep an open detail page current.
  watchRuns: protectedProcedure
    .meta(
      openapi({
        summary: "Watch a cron job's runs",
        description:
          "Opens an event stream for one cron job. Sends `subscribed` once listening, then a `run` event with the run id and its new status each time a run starts, finishes or is skipped. Events are not replayed: refetch the job and its runs on `subscribed`.",
        tags: ["System - Cron", "System"],
        method: "GET",
      })
    )
    .input(cronInput.watchRuns)
    .output(cronOutput.watchRuns)
    .handler(({ input, signal }) => cronHandler.watchRuns({ input, signal })),
}
