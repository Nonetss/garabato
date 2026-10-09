import { getIcon } from "@/lib/icon-registry"

const ExternalLink = getIcon("actions", "openExternal")
const KeyRound = getIcon("entities", "apiKey")
const Plus = getIcon("actions", "add")

import { useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { HeroCount } from "@/components/shared/layout/page-hero"
import { EntityList } from "@/components/shared/resource/entity-list"
import { ResourceOverview } from "@/components/shared/resource/resource-overview"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ApiKeyCreatedDialog } from "@/features/admin/api-keys/components/api-key-created-dialog"
import { ApiKeyFormModal } from "@/features/admin/api-keys/components/api-key-form-modal"
import { apiKeyListDefinition } from "@/features/admin/api-keys/definitions/api-key-list.definition"
import {
  useApiKeyDelete,
  useApiKeysList,
} from "@/features/admin/api-keys/hooks/use-api-keys"
import type { ApiKeyListItem } from "@/features/admin/api-keys/model/types"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"
import { useTargetDialog } from "@/hooks/use-target-dialog"

export function ApiKeysContent() {
  const { data: apiKeys = [], isPending, isError, refetch } = useApiKeysList()
  const deleteApiKey = useApiKeyDelete()

  const [createOpen, setCreateOpen] = useState(false)
  const createdKeyDialog = useTargetDialog<string>()

  const deleteDialog = useTargetConfirmDialog<ApiKeyListItem>({
    title: "Eliminar API key",
    description: (key) =>
      `Esta acción no se puede deshacer. Las integraciones que usen «${key.name?.trim() || "esta clave"}» dejarán de funcionar.`,
    confirmLabel: "Eliminar",
    onConfirm: (key) => deleteApiKey.mutateAsync({ id: key.id }),
  })

  const openCreateModal = () => setCreateOpen(true)
  const deletingId = deleteApiKey.isPending
    ? (deleteApiKey.variables?.id ?? null)
    : null

  return (
    <>
      <ResourceOverview
        maxWidth="80%"
        surface="admin-api-keys"
        description="Crea y revoca credenciales para conectar servicios con esta aplicación."
        heroMeta={
          <HeroCount
            segments={[
              {
                count: apiKeys.length,
                label: apiKeys.length === 1 ? "clave" : "claves",
              },
            ]}
          />
        }
        heroAction={
          <Button onClick={openCreateModal}>
            <Plus className="size-4" />
            Nueva API key
          </Button>
        }
        heroChildren={
          <div className="flex items-center justify-between gap-3 border-y py-3 text-sm">
            <Text
              as="p"
              variant="compact"
              tone="muted"
              className="min-w-0 flex-1 leading-relaxed"
            >
              Consulta los endpoints, parámetros y respuestas de la API en{" "}
              <a
                href="/scalar"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-foreground underline underline-offset-4 hover:text-primary"
              >
                /scalar
              </a>
              .
            </Text>
            <a
              href="/scalar"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir documentación de la API"
              className="shrink-0 text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        }
        query={{ data: apiKeys, isPending, isError, refetch }}
        loading="Cargando API keys…"
        error={{
          icon: <KeyRound className="size-6" />,
          title: "No se pudieron cargar las API keys",
          description:
            "Comprueba tu conexión y tus permisos; si el problema continúa, inténtalo de nuevo más tarde.",
        }}
        isEmpty={(data) => data.length === 0}
        empty={{
          icon: <KeyRound className="size-6" />,
          title: "No hay API keys",
          description:
            "Crea una clave para que un servicio pueda autenticarse con la API.",
          action: <Button onClick={openCreateModal}>Nueva API key</Button>,
        }}
      >
        {(data) => (
          <div className="min-w-0 flex-1">
            <EntityList
              items={data}
              context={{
                deletingId,
                onDelete: deleteDialog.open,
              }}
              definition={apiKeyListDefinition}
            />
          </div>
        )}
      </ResourceOverview>

      <ApiKeyFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={createdKeyDialog.open}
      />

      <ApiKeyCreatedDialog
        {...createdKeyDialog.dialogProps}
        fullKey={createdKeyDialog.target}
      />

      <ConfirmDialog {...deleteDialog.confirmDialogProps} />
    </>
  )
}
