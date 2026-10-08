export type DocumentSummary = {
  id: string
  name: string
  pageCount: number
  /** Size of the current version. */
  sizeBytes: number
  versionCount: number
  signatureCount: number
  lastSignedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DocumentVersion = {
  id: string
  number: number
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
}

export type DocumentDetail = DocumentSummary & {
  versions: DocumentVersion[]
  signatures: SignatureRecord[]
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
