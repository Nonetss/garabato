/** Complete rows with fixed defaults, for queueing on the fake database. */
import type {
  comments,
  entityIcons,
  member,
  organization,
  session,
  team,
  user,
} from "#schema"
import type { cronJob, cronRun } from "#schema/cron"

export type CronJobRow = typeof cronJob.$inferSelect
export type CronRunRow = typeof cronRun.$inferSelect
export type UserRow = typeof user.$inferSelect
export type SessionRow = typeof session.$inferSelect
export type CommentRow = typeof comments.$inferSelect
export type EntityIconRow = typeof entityIcons.$inferSelect
export type OrganizationRow = typeof organization.$inferSelect
export type MemberRow = typeof member.$inferSelect
export type TeamRow = typeof team.$inferSelect

export const NOW = new Date("2026-01-01T00:00:00.000Z")

export function cronJobRow(overrides: Partial<CronJobRow> = {}): CronJobRow {
  return {
    id: "job-1",
    name: "Nightly cleanup",
    description: null,
    cronExpression: "0 3 * * *",
    timezone: "UTC",
    enabled: true,
    handlerKey: "v1.maintenance.cleanup",
    source: "manual",
    userId: null,
    payload: null,
    lastRunAt: null,
    nextRunAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function cronRunRow(overrides: Partial<CronRunRow> = {}): CronRunRow {
  return {
    id: "run-1",
    jobId: "job-1",
    status: "running",
    handlerKey: "v1.maintenance.cleanup",
    startedAt: NOW,
    finishedAt: null,
    errorMessage: null,
    result: null,
    ...overrides,
  }
}

export function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    createdAt: NOW,
    updatedAt: NOW,
    role: "user",
    banned: false,
    banReason: null,
    banExpires: null,
    ...overrides,
  }
}

export function sessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "session-1",
    expiresAt: NOW,
    token: "token-1",
    createdAt: NOW,
    updatedAt: NOW,
    ipAddress: null,
    userAgent: null,
    userId: "user-1",
    impersonatedBy: null,
    activeOrganizationId: null,
    activeTeamId: null,
    ...overrides,
  }
}

export function commentRow(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: "comment-1",
    content: "First!",
    entityType: "organization",
    entityId: "00000000-0000-4000-8000-000000000001",
    parentId: null,
    authorId: "user-1",
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function entityIconRow(
  overrides: Partial<EntityIconRow> = {}
): EntityIconRow {
  return {
    id: "icon-1",
    entityType: "organization",
    entityId: "org-1",
    icon: "book-open",
    color: "orange",
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function organizationRow(
  overrides: Partial<OrganizationRow> = {}
): OrganizationRow {
  return {
    id: "org-1",
    name: "Acme",
    slug: "acme",
    logo: null,
    createdAt: NOW,
    metadata: null,
    ...overrides,
  }
}

export function memberRow(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    id: "member-1",
    organizationId: "org-1",
    userId: "user-1",
    role: "member",
    createdAt: NOW,
    ...overrides,
  }
}

export function teamRow(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: "team-1",
    name: "Platform",
    memberCount: 0,
    organizationId: "org-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}
