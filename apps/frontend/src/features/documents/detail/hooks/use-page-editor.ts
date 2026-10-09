import { useReducer } from "react"
import {
  canSave,
  editRequestPages,
  initialPages,
  isDirty,
  pageEditorReducer,
  pageEditorSummary,
} from "@/features/documents/detail/model/page-editor"

/** The page editor's state for a `pageCount`-page version. */
export function usePageEditor(pageCount: number) {
  const [pages, dispatch] = useReducer(
    pageEditorReducer,
    pageCount,
    initialPages
  )

  return {
    pages,
    summary: pageEditorSummary(pages),
    dirty: isDirty(pages),
    canSave: canSave(pages),
    requestPages: () => editRequestPages(pages),
    move: (from: number, to: number) => dispatch({ type: "move", from, to }),
    rotate: (index: number, direction: "left" | "right") =>
      dispatch({ type: "rotate", index, direction }),
    toggleRemove: (index: number) => dispatch({ type: "toggleRemove", index }),
    reset: () => dispatch({ type: "reset", pageCount }),
  }
}
