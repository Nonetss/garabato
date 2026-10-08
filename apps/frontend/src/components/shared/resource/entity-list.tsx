import type { CSSProperties, ReactNode } from "react"
import { Fragment } from "react"
import { Text } from "@/components/shared/brand/typography"
import { MetadataCell } from "@/components/shared/data-display/metadata-cell"
import { RowActionsMenu } from "@/components/shared/data-display/row-actions-menu"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
import {
  StatusDot,
  type StatusDotTone,
  StatusTag,
} from "@/components/shared/data-display/status-dot"
import { AppLink } from "@/components/ui/app-link"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { type IconRef, resolveIconRef } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

export interface EntityListStatus {
  tone: StatusDotTone
  label: ReactNode
  /** Tooltip text, e.g. a ban reason. */
  title?: string
  pulse?: boolean
}

export interface EntityListMetadataDescriptor<TItem, TContext> {
  key: string
  label: string
  value: (item: TItem, context: TContext) => ReactNode
  hidden?: (item: TItem, context: TContext) => boolean
}

export interface EntityListActionDescriptor<TItem, TContext> {
  key: string
  /** Static label, or a function for state-dependent copy (e.g. "Banear" vs "Quitar baneo"). */
  label: string | ((item: TItem, context: TContext) => string)
  /** Static icon, or a function for a state-dependent icon (e.g. Shield vs ShieldOff). */
  icon?: IconRef | ((item: TItem, context: TContext) => IconRef | undefined)
  destructive?: boolean
  disabled?: (item: TItem, context: TContext) => boolean
  hidden?: (item: TItem, context: TContext) => boolean
  onSelect: (item: TItem, context: TContext) => void
}

export interface EntityListDefinition<TItem, TContext = void> {
  getKey: (item: TItem) => string
  /** Accessible name for the row's open control and action menu. Falls back to `getPrimary` when it returns a plain string. */
  getAccessibleLabel?: (item: TItem, context: TContext) => string
  getPrimary: (item: TItem, context: TContext) => ReactNode
  getSecondary?: (item: TItem, context: TContext) => ReactNode
  getStatus?: (item: TItem, context: TContext) => EntityListStatus | null
  /** Blocks the primary open control and the action menu, and dims the row (implies `isMuted`). */
  isDisabled?: (item: TItem, context: TContext) => boolean
  /** Dims the row (`opacity-60`) without blocking interaction — e.g. a paused-but-still-editable item. */
  isMuted?: (item: TItem, context: TContext) => boolean
  /**
   * Clicking the primary block opens/navigates via a click handler. Use
   * `getOpenHref` instead for real route navigation — that renders an
   * `AppLink` (view transitions, modified-click passthrough) rather than a
   * `<button onClick>`. Omit both for a non-interactive row.
   */
  onOpen?: (item: TItem, context: TContext) => void
  /** Real route navigation for the primary block, rendered as `AppLink`. Takes priority over `onOpen` if both are set. */
  getOpenHref?: (item: TItem, context: TContext) => string
  metadata?: EntityListMetadataDescriptor<TItem, TContext>[]
  /**
   * A narrow rich-leaf control rendered before the status/actions region —
   * e.g. an inline enabled/disabled checkbox. Fixed position, not a layout
   * escape hatch: it does not receive control over the row's structure.
   */
  renderTrailing?: (item: TItem, context: TContext) => ReactNode
  actions?: EntityListActionDescriptor<TItem, TContext>[]
}

const metadataColumnsClass: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 @md:grid-cols-4",
}

/** Caps the `dash-enter` stagger so a huge list doesn't take seconds to finish animating in. */
const MAX_STAGGER_INDEX = 12

function EntityListRow<TItem, TContext>({
  item,
  index,
  context,
  definition,
}: {
  item: TItem
  index: number
  context: TContext
  definition: EntityListDefinition<TItem, TContext>
}) {
  const disabled = definition.isDisabled?.(item, context) ?? false
  const muted = disabled || (definition.isMuted?.(item, context) ?? false)
  const status = definition.getStatus?.(item, context) ?? null
  const primary = definition.getPrimary(item, context)
  const secondary = definition.getSecondary?.(item, context)
  const visibleMetadata = (definition.metadata ?? []).filter(
    (field) => !field.hidden?.(item, context)
  )
  const visibleActions = (definition.actions ?? []).filter(
    (action) => !action.hidden?.(item, context)
  )
  const metadataColumns = Math.min(
    4,
    Math.max(1, visibleMetadata.length)
  ) as keyof typeof metadataColumnsClass
  const accessibleLabel =
    definition.getAccessibleLabel?.(item, context) ??
    (typeof primary === "string" ? primary : undefined)

  const primaryBlock = (
    <div className="flex min-w-0 items-start gap-3">
      {status ? (
        <StatusDot
          tone={status.tone}
          pulse={status.pulse}
          className="mt-1.5 shrink-0"
        />
      ) : null}
      <div className="min-w-0">
        <Text as="p" variant="title" className="truncate">
          {primary}
        </Text>
        {secondary ? (
          <Text
            as="p"
            variant="compact"
            tone="muted"
            className="mt-0.5 truncate"
          >
            {secondary}
          </Text>
        ) : null}
      </div>
    </div>
  )

  return (
    <li
      className={cn(
        "group dash-enter grid gap-4 px-4 py-4 transition-colors @2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] @2xl:items-center @2xl:gap-6 @2xl:px-5",
        muted && "opacity-60",
        !disabled && "hover:bg-muted/40"
      )}
      style={
        {
          "--dash-delay": `${Math.min(index, MAX_STAGGER_INDEX) * 40}ms`,
        } as CSSProperties
      }
    >
      {definition.getOpenHref && !disabled ? (
        <AppLink
          href={definition.getOpenHref(item, context)}
          aria-label={accessibleLabel}
          className="min-w-0 text-left"
        >
          {primaryBlock}
        </AppLink>
      ) : definition.onOpen && !disabled ? (
        <button
          type="button"
          onClick={() => definition.onOpen?.(item, context)}
          aria-label={accessibleLabel}
          className="min-w-0 text-left"
        >
          {primaryBlock}
        </button>
      ) : (
        primaryBlock
      )}

      <div className="@container min-w-0">
        <div
          className={cn(
            "grid gap-x-5 gap-y-3",
            metadataColumnsClass[metadataColumns]
          )}
        >
          {visibleMetadata.map((field) => (
            <MetadataCell key={field.key} label={field.label}>
              {field.value(item, context)}
            </MetadataCell>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 @2xl:justify-end">
        {definition.renderTrailing || status ? (
          <div className="flex items-center gap-2">
            {definition.renderTrailing?.(item, context)}
            {status ? (
              <StatusTag title={status.title}>{status.label}</StatusTag>
            ) : null}
          </div>
        ) : null}
        {visibleActions.length > 0 ? (
          <RowActionsMenu
            label={
              accessibleLabel ? `Acciones para ${accessibleLabel}` : undefined
            }
            disabled={disabled}
          >
            {visibleActions.map((action, actionIndex) => {
              const resolvedIconRef =
                typeof action.icon === "function"
                  ? action.icon(item, context)
                  : action.icon
              const Icon = resolvedIconRef
                ? resolveIconRef(resolvedIconRef)
                : null
              const label =
                typeof action.label === "function"
                  ? action.label(item, context)
                  : action.label
              const needsSeparator =
                action.destructive &&
                actionIndex > 0 &&
                !visibleActions[actionIndex - 1]?.destructive

              return (
                <Fragment key={action.key}>
                  {needsSeparator ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem
                    variant={action.destructive ? "destructive" : undefined}
                    disabled={action.disabled?.(item, context)}
                    aria-label={
                      accessibleLabel
                        ? `${label} ${accessibleLabel}`
                        : undefined
                    }
                    onClick={() => action.onSelect(item, context)}
                  >
                    {Icon ? <Icon className="size-4" /> : null}
                    {label}
                  </DropdownMenuItem>
                </Fragment>
              )
            })}
          </RowActionsMenu>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Descriptor-driven quiet-editorial list: a definition supplies item
 * identity, primary/secondary values, status, metadata and row actions, and
 * this component owns `SoftCardList`, semantic `ul`/`li` markup, responsive
 * row layout, hover/disabled treatment, the row action menu and capped
 * `dash-enter` entrance timing. Callers author leaf values (a metadata
 * `value()`, a status label) but never the row's structural layout.
 */
export function EntityList<TItem, TContext = void>({
  items,
  context,
  definition,
  className,
}: {
  items: TItem[]
  context: TContext
  definition: EntityListDefinition<TItem, TContext>
  className?: string
}) {
  return (
    // The list is the container its rows query: a row switches to columns
    // when the list is wide, whatever the viewport (sidebar, PageShell).
    <SoftCardList as="ul" className={cn("@container", className)}>
      {items.map((item, index) => (
        <EntityListRow
          key={definition.getKey(item)}
          item={item}
          index={index}
          context={context}
          definition={definition}
        />
      ))}
    </SoftCardList>
  )
}
