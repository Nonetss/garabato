import { getIcon } from "@/lib/icon-registry"

const ShieldPlus = getIcon("security", "grant")
const Trash2 = getIcon("actions", "delete")

import { Text } from "@/components/shared/brand/typography"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
import { Hint } from "@/components/shared/feedback/hint"
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
        <p className="text-muted-foreground text-sm">
          Esta organización no tiene roles personalizados. Usa Propietario,
          Administrador o Miembro, o crea uno nuevo.
        </p>
      ) : (
        <SoftCardList as="ul">
          {roles.map((role) => (
            <li key={role.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Text as="p" variant="title" className="truncate">
                  {role.role}
                </Text>
                <Text
                  as="p"
                  variant="compact"
                  tone="muted"
                  className="truncate"
                >
                  {describePermissions(role.permission)}
                </Text>
              </div>
              <Hint label="Eliminar rol">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar rol"
                  onClick={() => onRemoveClick(role.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Hint>
            </li>
          ))}
        </SoftCardList>
      )}
    </section>
  )
}
