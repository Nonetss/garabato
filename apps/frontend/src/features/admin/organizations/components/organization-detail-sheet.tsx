import { useState } from "react"
import { textVariants } from "@/components/shared/brand/typography"
import { StateCard } from "@/components/shared/feedback/state-card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AddMemberDialog } from "@/features/admin/organizations/components/add-member-dialog"
import { CreateRoleDialog } from "@/features/admin/organizations/components/create-role-dialog"
import { InviteMemberDialog } from "@/features/admin/organizations/components/invite-member-dialog"
import { OrganizationInvitationsSection } from "@/features/admin/organizations/components/organization-invitations-section"
import { OrganizationMembersSection } from "@/features/admin/organizations/components/organization-members-section"
import { OrganizationRolesSection } from "@/features/admin/organizations/components/organization-roles-section"
import { OrganizationTeamsSection } from "@/features/admin/organizations/components/organization-teams-section"
import {
  useInvitationCancel,
  useMemberRemove,
  useMemberRoleUpdate,
  useOrganizationDetail,
  useRoleRemove,
} from "@/features/admin/organizations/hooks/use-organization-detail"
import { useTargetConfirmDialog } from "@/hooks/use-target-confirm-dialog"

interface OrganizationDetailSheetProps {
  organizationId: string | null
  onOpenChange: (open: boolean) => void
}

export function OrganizationDetailSheet({
  organizationId,
  onOpenChange,
}: OrganizationDetailSheetProps) {
  const { data: org, isPending } = useOrganizationDetail(organizationId)
  const updateRole = useMemberRoleUpdate(organizationId ?? "")
  const removeMember = useMemberRemove(organizationId ?? "")
  const cancelInvitation = useInvitationCancel(organizationId ?? "")
  const removeRole = useRoleRemove(organizationId ?? "")

  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)

  const removeMemberDialog = useTargetConfirmDialog<string>({
    title: "Eliminar miembro",
    description: () => "El usuario perderá acceso a esta organización.",
    confirmLabel: "Eliminar",
    onConfirm: (memberId) => removeMember.mutateAsync({ memberId }),
  })

  const removeRoleDialog = useTargetConfirmDialog<string>({
    title: "Eliminar rol",
    description: () =>
      "Los miembros que tengan este rol perderán sus permisos asociados.",
    confirmLabel: "Eliminar",
    onConfirm: (roleId) => removeRole.mutateAsync({ id: roleId }),
  })

  const pendingInvitations =
    org?.invitations.filter((inv) => inv.status === "pending") ?? []

  return (
    <>
      <Sheet
        open={!!organizationId}
        onOpenChange={(open) => !open && onOpenChange(false)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{org?.name ?? "Organización"}</SheetTitle>
            <SheetDescription className={textVariants({ role: "compact" })}>
              {org ? `/${org.slug}` : "Cargando detalle..."}
            </SheetDescription>
          </SheetHeader>

          {isPending || !org ? (
            <div className="p-4">
              <StateCard spinner title="Cargando organización..." />
            </div>
          ) : (
            <div className="flex flex-col gap-6 px-4 pb-6">
              <OrganizationMembersSection
                members={org.members}
                customRoles={org.roles}
                onRoleChange={(memberId, role) =>
                  updateRole.mutate({ memberId, role })
                }
                onAddClick={() => setAddMemberOpen(true)}
                onRemoveClick={(memberId) => removeMemberDialog.open(memberId)}
              />

              <OrganizationInvitationsSection
                invitations={pendingInvitations}
                isCanceling={cancelInvitation.isPending}
                onInviteClick={() => setInviteOpen(true)}
                onCancelClick={(id) => cancelInvitation.mutate({ id })}
              />

              <OrganizationTeamsSection teams={org.teams} />

              <OrganizationRolesSection
                roles={org.roles}
                onCreateClick={() => setCreateRoleOpen(true)}
                onRemoveClick={(roleId) => removeRoleDialog.open(roleId)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {organizationId ? (
        <>
          <AddMemberDialog
            organizationId={organizationId}
            existingUserIds={org?.members.map((m) => m.userId) ?? []}
            customRoles={org?.roles ?? []}
            open={addMemberOpen}
            onOpenChange={setAddMemberOpen}
          />
          <InviteMemberDialog
            organizationId={organizationId}
            customRoles={org?.roles ?? []}
            open={inviteOpen}
            onOpenChange={setInviteOpen}
          />
          <CreateRoleDialog
            organizationId={organizationId}
            open={createRoleOpen}
            onOpenChange={setCreateRoleOpen}
          />
        </>
      ) : null}

      <ConfirmDialog {...removeMemberDialog.confirmDialogProps} />

      <ConfirmDialog {...removeRoleDialog.confirmDialogProps} />
    </>
  )
}
