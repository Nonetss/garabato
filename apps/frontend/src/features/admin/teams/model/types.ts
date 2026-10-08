import type { AppRouterClient } from "@nonete/api/router"

type OrganizationRouter = AppRouterClient["v1"]["organization"]

export type Team = Awaited<ReturnType<OrganizationRouter["listTeams"]>>[number]
export type TeamMember = Awaited<
  ReturnType<OrganizationRouter["listTeamMembers"]>
>[number]
