/** A user-typed label (folder or tag name): no control characters, trimmed. */
export function cleanLabel(value: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim()
}

/** Labels compare like their unique indexes do: ignoring case. */
export function sameLabel(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}
