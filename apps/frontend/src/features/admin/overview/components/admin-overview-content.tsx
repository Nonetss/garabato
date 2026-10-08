import { getIcon } from "@/lib/icon-registry"

const ArrowRight = getIcon("navigation", "forward")
const Users = getIcon("admin", "users")

import { Text } from "@/components/shared/brand/typography"
import { MetadataDefinitionList } from "@/components/shared/data-display/metadata-cell"
import { PageHero } from "@/components/shared/layout/page-hero"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminStats } from "@/features/admin/overview/hooks/use-admin-stats"

export function AdminOverviewContent() {
  const { data, isPending } = useAdminStats()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <PageHero
        surface="admin"
        description="Estado general de la aplicación."
      />

      <MetadataDefinitionList
        columns={3}
        className="dash-enter"
        context={{ data, isPending }}
        fields={[
          {
            key: "total",
            label: "Usuarios totales",
            value: ({ data, isPending }) =>
              isPending ? (
                <Skeleton className="mt-2 h-8 w-14" />
              ) : (
                <Text as="p" variant="stat" className="mt-1.5">
                  {data?.total ?? 0}
                </Text>
              ),
          },
          {
            key: "admins",
            label: "Administradores",
            value: ({ data, isPending }) =>
              isPending ? (
                <Skeleton className="mt-2 h-8 w-14" />
              ) : (
                <Text as="p" variant="stat" className="mt-1.5">
                  {data?.admins ?? 0}
                </Text>
              ),
          },
          {
            key: "banned",
            label: "Usuarios baneados",
            tone: "destructive",
            value: ({ data, isPending }) =>
              isPending ? (
                <Skeleton className="mt-2 h-8 w-14" />
              ) : (
                <Text as="p" variant="stat" className="mt-1.5">
                  {data?.banned ?? 0}
                </Text>
              ),
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Text as="p" variant="title">
            Gestión de usuarios
          </Text>
          <Text
            as="p"
            variant="compact"
            tone="muted"
            className="mt-0.5 leading-relaxed"
          >
            Crea cuentas, cambia contraseñas, banea o elimina usuarios.
          </Text>
        </div>
        <Button
          variant="outline"
          render={<AppLink href="/admin/users" />}
          nativeButton={false}
        >
          <Users className="size-4" />
          Ir a usuarios
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
