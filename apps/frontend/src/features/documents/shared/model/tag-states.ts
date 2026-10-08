/** A tag across a set of documents: on all of them, some, or none. */
export type TagState = "on" | "mixed" | "off"

/** Each tag carried by at least one document, with its state across all. */
export function initialTagStates(documents: { tagIds: string[] }[]) {
  const counts = new Map<string, number>()
  for (const document of documents) {
    for (const tagId of new Set(document.tagIds)) {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
    }
  }
  const states = new Map<string, TagState>()
  for (const [tagId, count] of counts) {
    states.set(tagId, count === documents.length ? "on" : "mixed")
  }
  return states
}

/**
 * What saving a draft does: tags the user turned on are added, tags turned
 * off removed; tags still `mixed` (or untouched) are left as they are.
 */
export function tagChanges(
  initial: Map<string, TagState>,
  draft: Map<string, TagState>
) {
  const add: string[] = []
  const remove: string[] = []
  for (const [tagId, state] of draft) {
    const before = initial.get(tagId) ?? "off"
    if (state === before) continue
    if (state === "on") add.push(tagId)
    if (state === "off") remove.push(tagId)
  }
  return { add, remove }
}
