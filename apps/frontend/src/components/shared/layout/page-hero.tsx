import { Fragment, type ReactNode } from "react"
import { Text } from "@/components/shared/brand/typography"
import { getAppSurface, type SurfaceId } from "@/lib/app-surfaces"
import { resolveIconRef } from "@/lib/icon-registry"
import { cn } from "@/lib/utils"

export interface HeroCountSegment {
  count: number
  label: string
  /** Optional icon shown before the count, e.g. a protocol's own icon. */
  icon?: ReactNode
}

/**
 * The repeated `PageHero` `meta` count copy — "N total", "N activos · M
 * total" — one `<span className="text-foreground">{count}</span> {label}`
 * per segment, joined by a hairline "·". Hidden entirely (matching every
 * existing call site) once the last segment's count is `0` — that segment is
 * always the page's overall total, so an empty collection hides the whole
 * line rather than showing "0 total".
 */
export function HeroCount({
  segments,
  className,
}: {
  segments: HeroCountSegment[]
  className?: string
}) {
  const total = segments.at(-1)
  if (!total || total.count <= 0) return null

  return (
    <Text
      as="p"
      variant="meta"
      tone="muted"
      className={cn("tabular-nums", className)}
    >
      {segments.map((segment, index) => (
        <Fragment key={segment.label}>
          {index > 0 ? <span className="mx-2 text-border">·</span> : null}
          <span className="inline-flex items-center gap-1 align-middle">
            {segment.icon ? (
              <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                {segment.icon}
              </span>
            ) : null}
            <span>
              <span className="text-foreground">{segment.count}</span>{" "}
              {segment.label}
            </span>
          </span>
        </Fragment>
      ))}
    </Text>
  )
}

interface PageHeroSharedProps {
  description?: ReactNode
  meta?: ReactNode
  status?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  /**
   * Vertically center the icon against the title and description together.
   * `false` keeps the icon on the title's line.
   */
  center?: boolean
}

type PageHeroProps = PageHeroSharedProps &
  (
    | {
        /**
         * Registered surface to source icon/title/description from. `icon`
         * and `title` stay overridable per-prop (e.g. a detail page keeping
         * the surface's icon but showing the loaded entity's name as title);
         * an explicit `description` likewise overrides the registry copy.
         */
        surface: SurfaceId
        icon?: ReactNode
        title?: ReactNode
      }
    | {
        surface?: undefined
        icon: ReactNode
        title: ReactNode
      }
  )

export function PageHero(props: PageHeroProps) {
  const {
    description,
    meta,
    status,
    action,
    children,
    className,
    center = false,
  } = props
  const surfaceData = props.surface ? getAppSurface(props.surface) : undefined
  const SurfaceIcon = surfaceData ? resolveIconRef(surfaceData.icon) : null

  const icon =
    props.icon ?? (SurfaceIcon ? <SurfaceIcon className="size-5" /> : null)
  const title = props.title ?? surfaceData?.label
  const resolvedDescription = description ?? surfaceData?.description

  const rightItemCount = [meta, status, action].filter(Boolean).length

  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div
          className={cn(
            "flex min-w-0 gap-2.5",
            center ? "items-center" : "items-start"
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-center text-primary",
              center
                ? "size-5"
                : "h-[calc(var(--font-size-display)*var(--line-height-display))] w-5"
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            {/* Entity names (a PDF's file name) can be one unbroken token. */}
            <Text as="h1" variant="display" className="wrap-break-word">
              {title}
            </Text>
            {resolvedDescription ? (
              <Text
                as="p"
                variant="meta"
                tone="muted"
                className="mt-0.5 max-w-prose text-pretty"
              >
                {resolvedDescription}
              </Text>
            ) : null}
          </div>
        </div>
        {rightItemCount > 0 ? (
          <div
            className={cn(
              "flex w-full min-w-0 flex-wrap items-center gap-3 sm:ml-auto sm:w-auto sm:justify-end",
              rightItemCount > 1 ? "justify-between" : "justify-end"
            )}
          >
            {meta}
            {status}
            {action}
          </div>
        ) : null}
      </div>

      {children ? <div className="w-full">{children}</div> : null}
    </header>
  )
}
