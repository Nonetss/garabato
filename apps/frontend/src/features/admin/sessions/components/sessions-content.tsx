import { getIcon } from "@/lib/icon-registry"

const History = getIcon("admin", "sessions")
const UserX = getIcon("identity", "userX")

import type { CSSProperties } from "react"
import { useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { InfiniteScrollSentinel } from "@/components/shared/data-display/infinite-scroll-sentinel"
import {
  MetadataCell,
  MetadataDefinitionList,
} from "@/components/shared/data-display/metadata-cell"
import { StatusDot } from "@/components/shared/data-display/status-dot"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { ScrollPanel } from "@/components/shared/layout/scroll-panel"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { useSessionHistory } from "@/features/admin/sessions/hooks/use-session-history"
import type { SessionRecord } from "@/features/admin/sessions/model/types"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const ENTER_CAP = 12

function SessionRow({
  session,
  index,
}: {
  session: SessionRecord
  index: number
}) {
  const isActive = new Date(session.expiresAt).getTime() > Date.now()

  return (
    <article
      className="@container group dash-enter px-4 py-2.5 transition-colors hover:bg-muted/40 sm:px-5"
      style={
        {
          "--dash-delay": `${Math.min(index, ENTER_CAP) * 40}ms`,
        } as CSSProperties
      }
    >
      <div className="grid gap-3 @3xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] @3xl:items-start @3xl:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <StatusDot
            tone={isActive ? "primary" : "muted"}
            className="mt-1.5 shrink-0"
          />
          <div className="min-w-0">
            <Text as="p" variant="title" className="truncate">
              {session.user.name}
            </Text>
            <Text
              as="p"
              variant="compact"
              tone="muted"
              className="mt-0.5 truncate"
            >
              {session.user.email}
            </Text>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <MetadataCell label="Dirección IP">
            <Text variant="data">{session.ipAddress ?? "No registrada"}</Text>
          </MetadataCell>
          <MetadataCell label="Estado">
            <Text variant="status" tone="muted">
              {isActive ? "Vigente" : "Caducada"}
            </Text>
          </MetadataCell>
        </div>

        <MetadataCell label="Iniciada">
          <Text variant="data" tone="muted" className="whitespace-nowrap">
            {formatDateTime(session.createdAt, { includeYear: true })}
          </Text>
        </MetadataCell>
      </div>

      <details className="mt-2.5 border-t pt-2.5">
        <summary
          className={cn(
            textVariants({ role: "compact", tone: "muted" }),
            "w-fit cursor-pointer underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          Ver información técnica
        </summary>
        <MetadataDefinitionList
          columns={3}
          bordered={false}
          className="mt-3 gap-x-5 gap-y-3 py-0"
          context={{ session, isActive }}
          fields={[
            {
              key: "userAgent",
              label: "User-agent",
              className: "@xl:col-span-3",
              value: ({ session }) => (
                <Text
                  variant="data"
                  tone="muted"
                  className="break-all leading-relaxed"
                >
                  {session.userAgent ?? "No registrado"}
                </Text>
              ),
            },
            {
              key: "sessionId",
              label: "ID de sesión",
              value: ({ session }) => (
                <Text variant="data" tone="muted" className="break-all">
                  {session.id}
                </Text>
              ),
            },
            {
              key: "userId",
              label: "ID de usuario",
              value: ({ session }) => (
                <Text variant="data" tone="muted" className="break-all">
                  {session.userId}
                </Text>
              ),
            },
            {
              key: "updatedAt",
              label: "Actualizada",
              value: ({ session }) => (
                <Text variant="data" tone="muted">
                  {formatDateTime(session.updatedAt, { includeYear: true })}
                </Text>
              ),
            },
            {
              key: "expiresAt",
              label: "Caduca",
              value: ({ session, isActive }) => (
                <span
                  className={cn(
                    textVariants({ role: "data" }),
                    isActive ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {formatDateTime(session.expiresAt, { includeYear: true })}
                </span>
              ),
            },
            {
              key: "activeOrg",
              label: "Organización activa",
              value: ({ session }) => (
                <Text variant="data" tone="muted" className="break-all">
                  {session.activeOrganizationId ?? "Ninguna"}
                </Text>
              ),
            },
            {
              key: "activeTeam",
              label: "Equipo activo",
              value: ({ session }) => (
                <Text variant="data" tone="muted" className="break-all">
                  {session.activeTeamId ?? "Ninguno"}
                </Text>
              ),
            },
          ]}
        />
      </details>
    </article>
  )
}

export function SessionsContent() {
  const {
    sessions,
    total,
    isPending,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useSessionHistory()

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null
  )
  const sentinelRef = useInfiniteScroll(
    scrollContainer,
    fetchNextPage,
    hasNextPage && !isFetchingNextPage
  )

  return (
    <ResourceOverview
      maxWidth="80%"
      surface="admin-sessions"
      description="Historial de accesos registrado por la aplicación."
      heroMeta={<HeroCount segments={[{ count: total, label: "registros" }]} />}
      query={{ data: sessions, isPending, isError, refetch }}
      loading="Cargando historial de sesiones..."
      error={{
        icon: <UserX className="size-6" />,
        title: "No se pudo cargar el historial de sesiones",
        description:
          "Comprueba tu conexión y que tu sesión tenga permisos de administración.",
      }}
      isEmpty={(data) => data.length === 0}
      empty={{
        icon: <History className="size-6" />,
        title: "No hay sesiones registradas",
        description: "El historial aparecerá aquí cuando se inicie una sesión.",
      }}
    >
      {(data) => (
        <ScrollPanel scrollRef={setScrollContainer} divided>
          {data.map((session, index) => (
            <SessionRow key={session.id} session={session} index={index} />
          ))}
          <InfiniteScrollSentinel
            sentinelRef={sentinelRef}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </ScrollPanel>
      )}
    </ResourceOverview>
  )
}
