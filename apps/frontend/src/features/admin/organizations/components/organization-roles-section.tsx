import { getIcon } from "@/lib/icon-registry"

const ShieldPlus = getIcon("security", "grant")
const Trash2 = getIcon("actions", "delete")

import { Text } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { IconButton } from "@/components/shared/form/icon-button"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { Button } from "@/components/ui/button"
import { describePermissions } from "@/features/admin/organizations/definitions/role-options"
import type { OrganizationCustomRole } from "@/features/admin/organizations/model/types"

/** The organization detail sheet's "Roles personalizados" section: header +
 *  create action, empty state, or the custom-role list with removal. */
export function OrganizationRolesSection({
  roles,
  onCreateClick,
  onRemoveClick,
}: {
  roles: OrganizationCustomRole[]
  onCreateClick: () => void
  onRemoveClick: (roleId: string) => void
}) {
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Roles personalizados"
        count={roles.length}
        action={
          <Button size="sm" variant="outline" onClick={onCreateClick}>
            <ShieldPlus className="size-4" />
            Nuevo rol
          </Button>
        }
      />

      {roles.length === 0 ? (
        <Text as="p" variant="meta" tone="muted">
          Esta organización no tiene roles personalizados. Usa Propietario,
          Administrador o Miembro, o crea uno nuevo.
        </Text>
      ) : (
        <SoftCardList as="ul">
          {roles.map((role) => (
            <SoftCardListItem
              key={role.id}
              density="dense"
              truncate
              title={role.role}
              description={describePermissions(role.permission)}
              trailing={
                <IconButton
                  label="Eliminar rol"
                  icon={Trash2}
                  onClick={() => onRemoveClick(role.id)}
                />
              }
            />
          ))}
        </SoftCardList>
      )}
    </section>
  )
}
