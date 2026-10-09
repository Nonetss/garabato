import type { TrailType } from "@/features/traces/overview/model/types"
import { getIcon } from "@/lib/icon-registry"

/** The icon of each entry type. */
export const TRAIL_TYPE_ICONS = {
  "document.signed": getIcon("actions", "sign"),
  "document.uploaded": getIcon("actions", "upload"),
  "document.merged": getIcon("actions", "merge"),
  "document.pagesEdited": getIcon("actions", "editPages"),
  "document.downloaded": getIcon("actions", "download"),
  "document.renamed": getIcon("actions", "edit"),
  "document.moved": getIcon("actions", "move"),
  "document.versionDeleted": getIcon("actions", "restore"),
  "document.deleted": getIcon("actions", "delete"),
  "certificate.imported": getIcon("navigation", "certificates"),
  "certificate.renamed": getIcon("actions", "edit"),
  "certificate.passwordRemembered": getIcon("security", "rememberPassword"),
  "certificate.passwordForgotten": getIcon("security", "forgetPassword"),
  "certificate.deleted": getIcon("actions", "delete"),
} satisfies Record<TrailType, unknown>
