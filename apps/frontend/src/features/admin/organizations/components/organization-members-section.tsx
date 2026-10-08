import { getIcon } from "@/lib/icon-registry"

const Trash2 = getIcon("actions", "delete")
const UserPlus = getIcon("identity", "addUser")

import { Text } from "@/components/shared/brand/typography"
import { SoftCardList } from "@/components/shared/data-display/soft-card-list"
import { Hint } from "@/components/shared/feedback/hint"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { UserAvatar } from "@/components/shared/user/avatar"
import { Button } from "@/components/ui/button"
import { RoleSelect } from "@/features/admin/organizations/components/role-select"
import type {
  OrganizationCustomRole,
  OrganizationMember,
} from "@/features/admin/organizations/model/types"

/** The organization detail sheet's "Miembros" section: header + add action,
 *  empty state, or the member list with inline role editing and removal. */
export function OrganizationMembersSection({
  members,
  customRoles,
  onRoleChange,
  onAddClick,
  onRemoveClick,
}: {
  members: OrganizationMember[]
  customRoles: OrganizationCustomRole[]
  onRoleChange: (memberId: string, role: string) => void
  onAddClick: () => void
  onRemoveClick: (memberId: string) => void
}) {
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Miembros"
        count={members.length}
        action={
          <Button size="sm" onClick={onAddClick}>
            <UserPlus className="size-4" />
            Añadir
          </Button>
        }
      />

      {members.length === 0 ? (
        <Text as="p" variant="meta" tone="muted">
          Todavía no hay miembros.
        </Text>
      ) : (
        <SoftCardList as="ul">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
              <UserAvatar
                displayName={member.user.name}
                email={member.user.email}
                imageUrl={member.user.image}
                size="sm"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <Text as="p" variant="title" className="truncate">
                  {member.user.name}
                </Text>
                <Text
                  as="p"
                  variant="compact"
                  tone="muted"
                  className="truncate"
                >
                  {member.user.email}
                </Text>
              </div>
              <RoleSelect
                size="sm"
                className="w-32 shrink-0"
                value={member.role}
                onValueChange={(role) => onRoleChange(member.id, role)}
                customRoles={customRoles}
              />
              <Hint label="Eliminar miembro">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar miembro"
                  onClick={() => onRemoveClick(member.id)}
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
