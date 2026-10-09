import type { PageRotation } from "@/features/documents/shared"
import { moveItem } from "@/features/documents/shared/public"

/** One tile of the editor: a page of the base version and what changes. */
export type EditorPage = {
  /** 0-based page of the version being edited. */
  source: number
  /** Clockwise degrees added to the page's own rotation. */
  rotation: PageRotation
  /** Removed pages keep their tile, so they can be restored in place. */
  removed: boolean
}

export type PageEditorAction =
  | { type: "move"; from: number; to: number }
  | { type: "rotate"; index: number; direction: "left" | "right" }
  | { type: "toggleRemove"; index: number }
  | { type: "reset"; pageCount: number }

const ROTATIONS: PageRotation[] = [0, 90, 180, 270]

/** Every page in its order, unrotated and kept. */
export function initialPages(pageCount: number): EditorPage[] {
  return Array.from({ length: pageCount }, (_, source) => ({
    source,
    rotation: 0,
    removed: false,
  }))
}

function turned(rotation: PageRotation, direction: "left" | "right") {
  const step = direction === "right" ? 1 : ROTATIONS.length - 1
  const index = ROTATIONS.indexOf(rotation) + step
  return ROTATIONS[index % ROTATIONS.length] ?? 0
}

function updateAt(
  pages: EditorPage[],
  index: number,
  update: (page: EditorPage) => EditorPage
) {
  if (!pages[index]) return pages
  return pages.map((page, at) => {
    if (at !== index) return page
    return update(page)
  })
}

export function pageEditorReducer(
  pages: EditorPage[],
  action: PageEditorAction
): EditorPage[] {
  switch (action.type) {
    case "move":
      return moveItem(pages, action.from, action.to)
    case "rotate":
      return updateAt(pages, action.index, (page) => ({
        ...page,
        rotation: turned(page.rotation, action.direction),
      }))
    case "toggleRemove":
      return updateAt(pages, action.index, (page) => ({
        ...page,
        removed: !page.removed,
      }))
    case "reset":
      return initialPages(action.pageCount)
  }
}

/** The pages that will be saved, in order. */
function keptPages(pages: EditorPage[]) {
  return pages.filter((page) => !page.removed)
}

/** Whether saving would change the document. */
export function isDirty(pages: EditorPage[]) {
  return pages.some(
    (page, index) =>
      page.removed || page.rotation !== 0 || page.source !== index
  )
}

/** How many pages the result has, and how many are removed or rotated. */
export function pageEditorSummary(pages: EditorPage[]) {
  const kept = keptPages(pages)
  return {
    pageCount: kept.length,
    removed: pages.length - kept.length,
    rotated: kept.filter((page) => page.rotation !== 0).length,
  }
}

/** Whether "Guardar" can send the edit: something changed, a page is left. */
export function canSave(pages: EditorPage[]) {
  return isDirty(pages) && keptPages(pages).length > 0
}

/** The `pages` of the edit request. */
export function editRequestPages(pages: EditorPage[]) {
  return keptPages(pages).map((page) => ({
    page: page.source,
    rotation: page.rotation,
  }))
}
