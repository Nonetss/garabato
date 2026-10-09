import { getIcon } from "@/lib/icon-registry"

const DownloadIcon = getIcon("actions", "download")

import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { IconButton } from "@/components/shared/form/icon-button"
import { type DocumentVersion, versionLabel } from "@/features/documents/shared"
import { formatDateTime, formatFileSize } from "@/lib/format"

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
        <SoftCardListItem
          key={version.id}
          title={versionLabel(version)}
          description={
            <>
              {formatDateTime(version.createdAt, { includeYear: true })} ·{" "}
              {formatFileSize(version.sizeBytes)}
            </>
          }
          trailing={
            <IconButton
              label={`Descargar v${version.number}`}
              accessibleLabel={`Descargar versión ${version.number}`}
              icon={DownloadIcon}
              onClick={() => onDownload(version)}
            />
          }
        />
      ))}
    </SoftCardList>
  )
}
