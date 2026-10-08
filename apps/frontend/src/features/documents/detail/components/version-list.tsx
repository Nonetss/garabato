import { getIcon } from "@/lib/icon-registry"

const DownloadIcon = getIcon("actions", "download")

import { Text } from "@/components/shared/brand/typography"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
import { Hint } from "@/components/shared/feedback/hint"
import { Button } from "@/components/ui/button"
import type { DocumentVersion } from "@/features/documents/shared"
import { formatDateTime, formatFileSize } from "@/lib/format"

function versionLabel(version: DocumentVersion) {
  if (version.number === 1) return "v1 · original"
  return `v${version.number} · firmada`
}

interface VersionListProps {
  versions: DocumentVersion[]
  onDownload: (version: DocumentVersion) => void
}

/** Every stored version, newest first, each downloadable. */
export function VersionList({ versions, onDownload }: VersionListProps) {
  const newestFirst = [...versions].reverse()
  return (
    <SoftCardList as="ul">
      {newestFirst.map((version) => (
        <li key={version.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <Text as="p" variant="title">
              {versionLabel(version)}
            </Text>
            <Text
              as="p"
              variant="meta-sm"
              tone="muted"
              className="tabular-nums"
            >
              {formatDateTime(version.createdAt, { includeYear: true })} ·{" "}
              {formatFileSize(version.sizeBytes)}
            </Text>
          </div>
          <Hint label={`Descargar v${version.number}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Descargar versión ${version.number}`}
              onClick={() => onDownload(version)}
            >
              <DownloadIcon aria-hidden="true" />
            </Button>
          </Hint>
        </li>
      ))}
    </SoftCardList>
  )
}
