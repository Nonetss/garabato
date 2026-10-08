import type { ReactNode } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { cn } from "@/lib/utils"

/** Visual emphasis for the value row of a `MetadataCell`. */
export type MetadataCellTone = "default" | "destructive"

interface MetadataCellBaseProps {
  /** Micro-caps label rendered above the value. */
  label: string
  /** Value: text, icons, badges, code, skeleton. Anything inline. */
  children: ReactNode
  /**
   * Optional right-side affordance — e.g. an edit button. Sits between the
   * value column and the next cell on the same row.
   */
  action?: ReactNode
  /** Apply destructive emphasis to the value row (e.g. "Banned" stats). */
  tone?: MetadataCellTone
  className?: string
}

type DivMetadataCellProps = MetadataCellBaseProps & {
  as?: "div"
}

type DlMetadataCellProps = MetadataCellBaseProps & {
  as: "dl"
}

/**
 * Micro-caps label + value cell. The shared counterpart to the per-file
 * `Fact` / `Meta` / `Stat` reimplementations across the app.
 *
 * Default renders as `<div>` (sits inside any container). Pass `as="dl"` to
 * emit `<dt>` / `<dd>` so the cell can be a child of a `<dl>` (typically a
 * `MetadataList`).
 */
export function MetadataCell(
  props: DivMetadataCellProps | DlMetadataCellProps
) {
  const { label, children, action, tone = "default", className } = props
  const asDl = props.as === "dl"

  const valueClass = cn(
    "mt-1.5",
    textVariants({
      role: "body",
      tone: tone === "destructive" ? "destructive" : "default",
    })
  )

  if (asDl) {
    if (action) {
      return (
        <div
          className={cn(
            "flex min-w-0 items-start justify-between gap-3",
            className
          )}
        >
          <div className="min-w-0">
            <Text as="dt" variant="label" tone="muted">
              {label}
            </Text>
            <dd className={valueClass}>{children}</dd>
          </div>
          {action}
        </div>
      )
    }
    return (
      <div className={cn("min-w-0", className)}>
        <Text as="dt" variant="label" tone="muted">
          {label}
        </Text>
        <dd className={valueClass}>{children}</dd>
      </div>
    )
  }

  return (
    <div className={cn("min-w-0", className)}>
      <Text as="p" variant="label" tone="muted">
        {label}
      </Text>
      <div className={valueClass}>{children}</div>
      {action}
    </div>
  )
}

/** Number of columns the grid exposes. */
export type MetadataColumns = 1 | 2 | 3 | 4 | 5

interface MetadataListProps {
  columns: MetadataColumns
  /**
   * Add `border-y` to draw the standard hairline frame. Defaults to `true`
   * because most call sites use it; pass `false` to opt out (e.g. when the
   * list is inside a sheet body).
   */
  bordered?: boolean
  /** When `true`, render as `<dl>` so `MetadataCell` can emit `<dt>/<dd>`. */
  asDefinitionList?: boolean
  children: ReactNode
  className?: string
}

/**
 * Grid wrapper around `MetadataCell`. Replaces the recurring
 * `<dl className="grid grid-cols-… gap-x-6 gap-y-5 border-y py-5">` pattern.
 * Columns follow the width the list is rendered in (container queries), not
 * the viewport, so the same list fits a full-width page and a narrow detail
 * section. `className` targets the grid itself; column overrides passed
 * through it must use container variants (`@3xl:grid-cols-4`), not `sm:`.
 */
export function MetadataList({
  columns,
  bordered = true,
  asDefinitionList = false,
  children,
  className,
}: MetadataListProps) {
  const gridClass = cn(
    "grid gap-x-6 gap-y-5 py-5",
    columns === 1 && "grid-cols-1",
    columns === 2 && "grid-cols-1 @md:grid-cols-2",
    columns === 3 && "grid-cols-1 @xl:grid-cols-3",
    columns === 4 && "grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-4",
    columns === 5 && "grid-cols-1 @xl:grid-cols-3 @4xl:grid-cols-5",
    bordered && "border-y",
    className
  )

  return (
    <div className="@container min-w-0">
      {asDefinitionList ? (
        <dl className={gridClass}>{children}</dl>
      ) : (
        <div className={gridClass}>{children}</div>
      )}
    </div>
  )
}

function resolve<TValue, TContext>(
  value: TValue | ((context: TContext) => TValue) | undefined,
  context: TContext
): TValue | undefined {
  return typeof value === "function"
    ? (value as (context: TContext) => TValue)(context)
    : value
}

export interface MetadataFieldDescriptor<TContext> {
  /** Stable React key — not rendered. */
  key: string
  label: string
  value: (context: TContext) => ReactNode
  tone?: MetadataCellTone | ((context: TContext) => MetadataCellTone)
  action?: ReactNode | ((context: TContext) => ReactNode)
  /** Omit this field's `dt`/`dd` pair entirely (e.g. an optional value with nothing to show). */
  hidden?: (context: TContext) => boolean
  className?: string
}

/**
 * Descriptor-driven `MetadataList`: supply one `context` object and a list of
 * field descriptors instead of authoring `MetadataCell` children by hand. The
 * component owns the entire `dl`/`dt`/`dd` tree — a caller cannot nest a
 * second `dd` inside a cell's value the way hand-authored `MetadataCell`
 * children could.
 */
export function MetadataDefinitionList<TContext>({
  context,
  fields,
  columns,
  bordered,
  className,
}: {
  context: TContext
  fields: MetadataFieldDescriptor<TContext>[]
  columns: MetadataColumns
  bordered?: boolean
  className?: string
}) {
  const visibleFields = fields.filter((field) => !field.hidden?.(context))

  return (
    <MetadataList
      columns={columns}
      bordered={bordered}
      asDefinitionList
      className={className}
    >
      {visibleFields.map((field) => (
        <MetadataCell
          key={field.key}
          as="dl"
          label={field.label}
          tone={resolve(field.tone, context)}
          action={resolve(field.action, context)}
          className={field.className}
        >
          {field.value(context)}
        </MetadataCell>
      ))}
    </MetadataList>
  )
}
