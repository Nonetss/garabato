/** Complete rows with fixed defaults, for queueing on the fake database. */
import type {
  certificates,
  comments,
  documentFolders,
  documentSignatures,
  documents,
  documentTagAssignments,
  documentTags,
  documentVersions,
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
export type CertificateRow = typeof certificates.$inferSelect
export type DocumentRow = typeof documents.$inferSelect
export type DocumentFolderRow = typeof documentFolders.$inferSelect
export type DocumentTagRow = typeof documentTags.$inferSelect
export type DocumentTagAssignmentRow =
  typeof documentTagAssignments.$inferSelect
export type DocumentVersionRow = typeof documentVersions.$inferSelect
export type DocumentSignatureRow = typeof documentSignatures.$inferSelect
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

// The sealed columns hold placeholders: a test that decrypts them overrides
// them with values sealed by the vault for the row's id.
export function certificateRow(
  overrides: Partial<CertificateRow> = {}
): CertificateRow {
  return {
    id: "00000000-0000-4000-8000-0000000000c1",
    userId: "user-1",
    alias: "Personal",
    commonName: "ESPAÑOL PÉREZ JUAN - 12345678Z",
    givenName: "JUAN",
    surname: "ESPAÑOL PÉREZ",
    taxId: "12345678Z",
    issuerCommonName: "AC PRUEBAS AUTOFIRMAS",
    serialNumber: "1DA4064E22D19F8E5ADFA4F4A5C540E11AE51FB9",
    fingerprintSha256:
      "79e9b2ecc60d29095afd435a404e828b5b84bb91e1c3a19e435c5650444148dc",
    keyAlgorithm: "RSA",
    notBefore: new Date("2025-01-01T00:00:00.000Z"),
    notAfter: new Date("2027-01-01T00:00:00.000Z"),
    encryptedDataKey: Buffer.from("wrapped-data-key"),
    encryptedP12: Buffer.from("sealed-p12"),
    encryptedPassword: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// `encryptedDataKey` holds a placeholder: a test that reads objects overrides
// it with a data key wrapped by the vault for the row's id.
export function documentRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "00000000-0000-4000-8000-0000000000d1",
    userId: "user-1",
    name: "contrato.pdf",
    pageCount: 3,
    folderId: null,
    pinnedAt: null,
    encryptedDataKey: Buffer.from("wrapped-data-key"),
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function documentFolderRow(
  overrides: Partial<DocumentFolderRow> = {}
): DocumentFolderRow {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    userId: "user-1",
    parentId: null,
    name: "Contratos",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function documentTagRow(
  overrides: Partial<DocumentTagRow> = {}
): DocumentTagRow {
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    userId: "user-1",
    name: "Urgente",
    color: "neutral",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function documentTagAssignmentRow(
  overrides: Partial<DocumentTagAssignmentRow> = {}
): DocumentTagAssignmentRow {
  return {
    documentId: "00000000-0000-4000-8000-0000000000d1",
    tagId: "00000000-0000-4000-8000-0000000000b1",
    createdAt: NOW,
    ...overrides,
  }
}

export function documentVersionRow(
  overrides: Partial<DocumentVersionRow> = {}
): DocumentVersionRow {
  return {
    id: "00000000-0000-4000-8000-0000000000e1",
    documentId: "00000000-0000-4000-8000-0000000000d1",
    number: 1,
    objectKey: "documents/00000000-0000-4000-8000-0000000000d1/v1",
    sizeBytes: 1024,
    sha256: "0".repeat(64),
    createdBy: "user-1",
    createdAt: NOW,
    ...overrides,
  }
}

export function documentSignatureRow(
  overrides: Partial<DocumentSignatureRow> = {}
): DocumentSignatureRow {
  return {
    id: "00000000-0000-4000-8000-0000000000f1",
    documentId: "00000000-0000-4000-8000-0000000000d1",
    versionId: "00000000-0000-4000-8000-0000000000e2",
    certificateId: "00000000-0000-4000-8000-0000000000c1",
    userId: "user-1",
    signedAt: NOW,
    visible: true,
    pages: [0],
    rect: { x: 0.6, y: 0.8, width: 0.3, height: 0.1 },
    reason: null,
    location: null,
    sha256Before: "0".repeat(64),
    sha256After: "1".repeat(64),
    ipAddress: null,
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
