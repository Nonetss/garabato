import { createAccessControl } from "better-auth/plugins/access"
import {
  adminAc,
  memberAc,
  defaultStatements as organizationStatements,
  ownerAc,
} from "better-auth/plugins/organization/access"

/**
 * Application permissions live here. Keep this free of project-specific
 * examples so a project can add only the resources it actually needs.
 *
 * @example
 * const appStatements = {
 *   project: ["read", "create", "update", "delete"],
 * } as const
 */
export const appStatements = {
  prueba: ["read", "create", "update", "delete"],
} as const satisfies Record<string, readonly string[]>

export const defaultStatements = {
  ...organizationStatements,
  ...appStatements,
} as const

export const ac = createAccessControl(defaultStatements)

export const owner = ac.newRole({
  ...ownerAc.statements,
  ...appStatements,
})
export const admin = ac.newRole({
  ...adminAc.statements,
  ...appStatements,
})
export const member = ac.newRole({ ...memberAc.statements })

export const roles = { owner, admin, member }
export type RoleName = keyof typeof roles

export type AppResource = Extract<keyof typeof appStatements, string>
export type AppAction<Resource extends AppResource> =
  (typeof appStatements)[Resource][number]
