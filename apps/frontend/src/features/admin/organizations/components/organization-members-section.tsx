import { getIcon } from "@/lib/icon-registry"

const Trash2 = getIcon("actions", "delete")
const UserPlus = getIcon("identity", "addUser")

import { Text } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { IconButton } from "@/components/shared/form/icon-button"
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
            <SoftCardListItem
              key={member.id}
              density="dense"
              truncate
              leading={
                <UserAvatar
                  displayName={member.user.name}
                  email={member.user.email}
                  imageUrl={member.user.image}
                  size="sm"
                  className="shrink-0"
                />
              }
              title={member.user.name}
              description={member.user.email}
              trailing={
                <>
                  <RoleSelect
                    size="sm"
                    className="w-32"
                    value={member.role}
                    onValueChange={(role) => onRoleChange(member.id, role)}
                    customRoles={customRoles}
                  />
                  <IconButton
                    label="Eliminar miembro"
                    icon={Trash2}
                    onClick={() => onRemoveClick(member.id)}
                  />
                </>
              }
            />
          ))}
        </SoftCardList>
      )}
    </section>
  )
}
