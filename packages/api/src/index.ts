import type { AppAction, AppResource } from "@nonete/auth/permissions"
import { defineMeta, os } from "@orpc/server"

import type { Context } from "#context"
import { errorMap, errors } from "#errors"
import { userHasOrganizationPermission } from "#lib/permissions"

/**
 * Who a procedure lets through. Declared by the builder that creates the
 * procedure, never by hand — that is what keeps it in sync with the
 * middleware actually enforcing it.
 */
export type AppAccess = "public" | "protected" | "admin" | "cron"

/**
 * How a procedure takes part in cron scheduling. The two forms are mutually
 * exclusive:
 *
 * - `{ eligible: true }` — an admin may schedule it from `/crons`.
 * - `{ schedule: "<UTC cron expression>", name?, description? }` — the code
 *   schedules it. `name` defaults to the procedure key and `description` to
 *   its route description. The backend syncs it into a read-only `code` job
 *   at startup; it runs as the seed administrator (`ADMIN_EMAIL`) — or with
 *   no user when that account doesn't exist — with an empty input, and nobody
 *   can edit, pause or trigger it.
 */
export type CronMeta =
  | { eligible: true; schedule?: never }
  | {
      schedule: string
      /** Job name shown in `/crons`; defaults to the procedure key. */
      name?: string
      /** Job description; defaults to the route description or summary. */
      description?: string
      eligible?: never
    }

// One meta plugin per concern; a later call replaces the earlier value, which
// is how each builder's `access` overrides the one it was built from.
const [accessMeta, getAccessMeta] = defineMeta(
  "access",
  (incoming: AppAccess) => incoming
)

/** Who a procedure lets through, as stamped by its builder. */
export { getAccessMeta }

/** Cron eligibility or a code-declared schedule: `.meta(cronMeta({...}))`. */
export const [cronMeta, getCronMeta] = defineMeta(
  "cron",
  (incoming: CronMeta) => incoming
)

export const o = os.$context<Context>().errors(errorMap)

export const publicProcedure = o.meta(accessMeta("public"))

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw errors.UNAUTHORIZED()
  }
  return next({
    context: {
      ...context,
      user: context.user,
      session: context.session,
    },
  })
})

export const protectedProcedure = publicProcedure
  .use(requireAuth)
  .meta(accessMeta("protected"))

const requireAdmin = o.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw errors.UNAUTHORIZED()
  }
  if (context.user.role !== "admin") {
    throw errors.FORBIDDEN()
  }
  return next({
    context: {
      ...context,
      user: context.user,
      session: context.session,
    },
  })
})

export const adminProcedure = publicProcedure
  .use(requireAdmin)
  .meta(accessMeta("admin"))

function requirePermission<Resource extends AppResource>(
  resource: Resource,
  action: AppAction<Resource>
) {
  return o.middleware(async ({ context, next }) => {
    if (!context.user || !context.session) {
      throw errors.UNAUTHORIZED()
    }

    if (context.user.role !== "admin") {
      const organizationId = context.session.activeOrganizationId
      if (!organizationId) {
        throw errors.FORBIDDEN({
          message: "An active organization is required",
        })
      }

      const allowed = await userHasOrganizationPermission({
        organizationId,
        headers: context.headers,
        resource,
        action,
      })
      if (!allowed) {
        throw errors.FORBIDDEN()
      }
    }

    return next({
      context: {
        ...context,
        user: context.user,
        session: context.session,
      },
    })
  })
}

/**
 * Organization-scoped application authorization. Add resources and actions to
 * `appStatements`, then build a procedure with
 * `permissionProcedure("resource", "action")`.
 *
 * Global admins bypass the organization check. Every other user must have an
 * active organization and the requested permission in that organization.
 */
export function permissionProcedure<Resource extends AppResource>(
  resource: Resource,
  action: AppAction<Resource>
) {
  return publicProcedure
    .use(requirePermission(resource, action))
    .meta(accessMeta("admin"))
}

const requireCron = o.middleware(async ({ context, next }) => {
  if (!context.cron) {
    throw errors.FORBIDDEN({ message: "This endpoint is cron-only" })
  }
  return next({ context })
})

/** Cron-only procedures — reachable solely with a scheduler-marked context. */
export const cronProcedure = publicProcedure
  .use(requireCron)
  .meta(accessMeta("cron"))
