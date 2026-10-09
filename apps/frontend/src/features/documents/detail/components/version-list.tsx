import { getIcon } from "@/lib/icon-registry"

const DownloadIcon = getIcon("actions", "download")
const DeleteIcon = getIcon("actions", "delete")

import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { IconButton } from "@/components/shared/form/icon-button"
import {
  type DocumentVersion,
  documentLabels,
  versionLabel,
} from "@/features/documents/shared"
import { formatDateTime, formatFileSize, joinFacts } from "@/lib/format"

interface VersionListProps {
  versions: DocumentVersion[]
  /** The version the viewer shows. */
  shownId: string | undefined
  onShow: (version: DocumentVersion) => void
  onDownload: (version: DocumentVersion) => void
  onDelete: (version: DocumentVersion) => void
}

// `v3 · firmada · actual` for the current version.
function rowTitle(version: DocumentVersion, isCurrent: boolean) {
  if (!isCurrent) return versionLabel(version)
  return joinFacts([versionLabel(version), documentLabels.currentVersion])
}

/**
 * Every live version, newest first: choosing one shows it in the viewer, each
 * can be downloaded, and the current one can be deleted while an earlier one
 * remains.
 */
export function VersionList({
  versions,
  shownId,
  onShow,
  onDownload,
  onDelete,
}: VersionListProps) {
  const current = versions.at(-1)
  const deletable = versions.length > 1
  const newestFirst = [...versions].reverse()
  return (
    <SoftCardList as="ul">
      {newestFirst.map((version) => {
        const isCurrent = version === current
        return (
          <SoftCardListItem
            key={version.id}
            title={rowTitle(version, isCurrent)}
            selected={version.id === shownId}
            onSelect={() => onShow(version)}
            description={
              <>
                {formatDateTime(version.createdAt, { includeYear: true })} ·{" "}
                {formatFileSize(version.sizeBytes)}
              </>
            }
            trailing={
              <div className="flex items-center gap-1">
                <IconButton
                  label={`Descargar v${version.number}`}
                  accessibleLabel={`Descargar versión ${version.number}`}
                  icon={DownloadIcon}
                  onClick={() => onDownload(version)}
                />
                {isCurrent && deletable ? (
                  <IconButton
                    label={documentLabels.deleteVersion}
                    accessibleLabel={`${documentLabels.deleteVersion} ${version.number}`}
                    icon={DeleteIcon}
                    onClick={() => onDelete(version)}
                  />
                ) : null}
              </div>
            }
          />
        )
      })}
    </SoftCardList>
  )
}
