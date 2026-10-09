import type { EntityIconColor } from "@/features/entity-icons"

export type DocumentSummary = {
  id: string
  name: string
  pageCount: number
  /** Size of the current version. */
  sizeBytes: number
  versionCount: number
  signatureCount: number
  lastSignedAt: string | null
  /** Null for the library root. */
  folderId: string | null
  tagIds: string[]
  /** When it was pinned; null when not pinned. */
  pinnedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DocumentFolder = {
  id: string
  name: string
  /** Null for a top-level folder. */
  parentId: string | null
  /** Live documents directly inside. */
  documentCount: number
  createdAt: string
  updatedAt: string
}

export type DocumentTag = {
  id: string
  name: string
  color: EntityIconColor
  /** Live documents carrying it. */
  documentCount: number
  createdAt: string
  updatedAt: string
}

/** What produced a version. */
export type DocumentVersionKind = "upload" | "merge" | "signature" | "pages"

export type DocumentVersion = {
  id: string
  number: number
  kind: DocumentVersionKind
  sizeBytes: number
  sha256: string
  createdAt: string
}

/** Fractions (0–1) of the displayed page, origin at its top-left. */
export type StampRect = {
  x: number
  y: number
  width: number
  height: number
}

export type SignatureRecord = {
  id: string
  documentId: string
  documentName: string
  documentDeleted: boolean
  versionId: string
  versionNumber: number
  certificateId: string
  certificateAlias: string
  certificateHolder: string
  signedAt: string
  visible: boolean
  /** 0-based pages with a stamp. */
  pages: number[]
  rect: StampRect | null
  reason: string | null
  location: string | null
  sha256Before: string
  sha256After: string
  ipAddress: string | null
  /** Time the TSA asserted (PAdES B-T); null for a B-B signature. */
  timestampedAt: string | null
  /** Name of the TSA that issued the timestamp; null for B-B. */
  timestampAuthority: string | null
}

export type DocumentDetail = DocumentSummary & {
  versions: DocumentVersion[]
  signatures: SignatureRecord[]
}

/** Clockwise degrees added to a page's own rotation. */
export type PageRotation = 0 | 90 | 180 | 270

export type EditPagesInput = {
  documentId: string
  baseVersionId: string
  /** The resulting pages in order: 0-based pages of the base version. */
  pages: { page: number; rotation: PageRotation }[]
}

export type MergeDocumentsInput = {
  documentIds: string[]
  name: string
  folderId?: string
}

export type SignAppearance =
  | { visible: false }
  | { visible: true; page: number; pages: "one" | "all"; rect: StampRect }

export type SignInput = {
  documentId: string
  baseVersionId: string
  certificateId: string
  password?: string
  reason?: string
  location?: string
  appearance: SignAppearance
}
