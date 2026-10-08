import { createHighlighter } from "@tanstack/highlight/core"
import { json } from "@tanstack/highlight/languages/json"
import type { ReactNode } from "react"
import { textVariants } from "@/components/shared/brand/typography"
import { cn } from "@/lib/utils"

interface JsonViewProps {
  value: unknown
  className?: string
  id?: string
}

/** JSON only: this viewer ships with every page that shows logs or runs. */
const jsonHighlighter = createHighlighter({ languages: [json] })

/**
 * Syntax-highlighted JSON viewer.
 *
 * Stringifies `value` with 2-space indent and colours it with TanStack
 * Highlight's JSON tokenizer, using the `--th-*` token palette in
 * `global.css`. Falls back to a plain
 * `<pre>` when the value isn't JSON-serializable so the surface stays useful
 * for edge cases (circular refs, BigInt, …).
 */
export function JsonView({ value, className, id }: JsonViewProps) {
  if (value === undefined) return null

  let text: string
  try {
    text = JSON.stringify(value, null, 2)
  } catch {
    return (
      <pre
        id={id}
        className={cn(
          textVariants({ role: "data" }),
          "overflow-auto rounded-lg border bg-muted/50 p-3 text-foreground/90 leading-relaxed whitespace-pre-wrap break-all",
          className
        )}
      >
        {String(value)}
      </pre>
    )
  }

  return (
    <pre
      id={id}
      className={cn(
        textVariants({ role: "data" }),
        "overflow-auto rounded-lg border bg-muted/50 p-3 text-foreground/90 leading-relaxed whitespace-pre-wrap break-all",
        className
      )}
    >
      {highlightJson(text)}
    </pre>
  )
}

/** Tokens become React spans, so no highlighter HTML is ever injected. */
function highlightJson(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let offset = 0

  for (const token of jsonHighlighter.tokenize(text, { lang: "json" }).tokens) {
    if (token.className) {
      nodes.push(
        <span key={offset} className={`th-token th-${token.className}`}>
          {token.value}
        </span>
      )
    } else {
      nodes.push(token.value)
    }
    offset += token.value.length
  }

  return nodes
}
