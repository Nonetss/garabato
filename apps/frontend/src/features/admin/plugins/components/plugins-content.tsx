import { getIcon } from "@/lib/icon-registry"

const Blocks = getIcon("admin", "plugins")

import type { CSSProperties } from "react"
import { Text } from "@/components/shared/brand/typography"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
import { StatusTag } from "@/components/shared/data-display/status-dot"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import {
  defaultPluginIcon,
  pluginMeta,
} from "@/features/admin/plugins/definitions/plugin-meta.definition"
import { usePluginsList } from "@/features/admin/plugins/hooks/use-plugins"

export function PluginsContent() {
  const { data: plugins = [], isPending, isError, refetch } = usePluginsList()

  return (
    <ResourceOverview
      maxWidth="80%"
      surface="admin-plugins"
      description="Plugins de Better Auth activos en el backend. Vista de solo lectura."
      heroMeta={
        <HeroCount segments={[{ count: plugins.length, label: "activos" }]} />
      }
      query={{ data: plugins, isPending, isError, refetch }}
      loading="Cargando plugins…"
      error={{
        icon: <Blocks className="size-6" />,
        title: "No se pudieron cargar los plugins",
        description:
          "Comprueba tu conexión y tus permisos de administración; después, vuelve a intentarlo.",
      }}
    >
      {(data) => (
        <SoftCardList as="ul">
          {data.map((plugin, index) => {
            const meta = pluginMeta[plugin.id]
            return (
              <li
                key={plugin.id}
                className="dash-enter flex items-start gap-3 px-4 py-4 sm:px-5"
                style={{ "--dash-delay": `${index * 40}ms` } as CSSProperties}
              >
                <span className="mt-0.5 text-primary">
                  {meta?.icon ?? defaultPluginIcon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Text as="p" variant="title">
                      {meta?.label ?? plugin.id}
                    </Text>
                    <StatusTag dotTone="primary">Activo</StatusTag>
                  </div>
                  <Text
                    as="p"
                    variant="compact"
                    tone="muted"
                    className="mt-1 leading-relaxed"
                  >
                    {meta?.description ??
                      `Plugin «${plugin.id}» registrado en Better Auth.`}
                  </Text>
                  <Text as="p" variant="data" tone="muted" className="mt-1.5">
                    {plugin.id}
                  </Text>
                </div>
              </li>
            )
          })}
        </SoftCardList>
      )}
    </ResourceOverview>
  )
}
