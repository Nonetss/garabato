import type { AppRouterClient } from "@nonete/api/router"
import type { RoleName } from "@nonete/auth/permissions"

type OrganizationRouter = AppRouterClient["v1"]["organization"]

export type Organization = Awaited<
  ReturnType<OrganizationRouter["list"]>
>[number]
export type OrganizationDetail = Awaited<ReturnType<OrganizationRouter["get"]>>
export type OrganizationMember = OrganizationDetail["members"][number]
export type OrganizationInvitation = OrganizationDetail["invitations"][number]
export type OrganizationCustomRole = OrganizationDetail["roles"][number]
export type OrganizationRole = RoleName
