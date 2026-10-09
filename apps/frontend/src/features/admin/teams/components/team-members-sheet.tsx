import { getIcon } from "@/lib/icon-registry"

const Trash2 = getIcon("actions", "delete")
const UserPlus = getIcon("identity", "addUser")

import { useState } from "react"
import { Text, textVariants } from "@/components/shared/brand/typography"
import {
  SoftCardList,
  SoftCardListItem,
} from "@/components/shared/data-display/soft-card-list"
import { StateCard } from "@/components/shared/feedback/state-card"
import { IconButton } from "@/components/shared/form/icon-button"
import { SectionHeading } from "@/components/shared/layout/section-heading"
import { UserAvatar } from "@/components/shared/user/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useOrganizationDetail } from "@/features/admin/organizations/public"
import {
  useTeamMemberAdd,
  useTeamMemberRemove,
  useTeamMembersList,
} from "@/features/admin/teams/hooks/use-teams"
import type { Team } from "@/features/admin/teams/model/types"

interface TeamMembersSheetProps {
  team: Team | null
  onOpenChange: (open: boolean) => void
}

export function TeamMembersSheet({
  team,
  onOpenChange,
}: TeamMembersSheetProps) {
  const teamId = team?.id ?? null
  const { data: members = [], isPending } = useTeamMembersList(teamId)
  const { data: org } = useOrganizationDetail(team?.organizationId ?? null)
  const addTeamMember = useTeamMemberAdd(teamId ?? "")
  const removeTeamMember = useTeamMemberRemove(teamId ?? "")

  const [pickedUserId, setPickedUserId] = useState("")

  const memberUserIds = new Set(members.map((m) => m.userId))
  const candidates = (org?.members ?? []).filter(
    (m) => !memberUserIds.has(m.userId)
  )

  const handleAdd = async () => {
    if (!teamId || !pickedUserId) return
    await addTeamMember.mutateAsync({ teamId, userId: pickedUserId })
    setPickedUserId("")
  }

  return (
    <Sheet open={!!team} onOpenChange={(open) => !open && onOpenChange(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{team?.name ?? "Equipo"}</SheetTitle>
          <SheetDescription className={textVariants({ role: "compact" })}>
            Miembros del equipo
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex items-center gap-2">
            <Select
              items={candidates.map((member) => ({
                value: member.userId,
                label: `${member.user.name} (${member.user.email})`,
              }))}
              value={pickedUserId}
              onValueChange={(value) => {
                if (value !== null) setPickedUserId(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Añadir miembro de la organización" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <Text
                    as="div"
                    variant="meta"
                    tone="muted"
                    className="px-2 py-1.5"
                  >
                    No hay miembros disponibles
                  </Text>
                ) : (
                  candidates.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user.name} ({m.user.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <IconButton
              label="Añadir miembro"
              icon={UserPlus}
              variant="default"
              size="icon"
              pending={addTeamMember.isPending}
              disabled={!pickedUserId || addTeamMember.isPending}
              onClick={handleAdd}
            />
          </div>

          {isPending ? (
            <StateCard spinner title="Cargando miembros…" />
          ) : members.length === 0 ? (
            <Text as="p" variant="meta" tone="muted">
              Este equipo no tiene miembros todavía.
            </Text>
          ) : (
            <div className="space-y-3">
              <SectionHeading title="Miembros" count={members.length} />
              <SoftCardList as="ul">
                {members.map((member) => (
                  <SoftCardListItem
                    key={member.userId}
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
                      <IconButton
                        label="Eliminar del equipo"
                        icon={Trash2}
                        disabled={removeTeamMember.isPending}
                        onClick={() =>
                          teamId &&
                          removeTeamMember.mutate({
                            teamId,
                            userId: member.userId,
                          })
                        }
                      />
                    }
                  />
                ))}
              </SoftCardList>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
