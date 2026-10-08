import { z } from "zod"

const sessionUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
})

const sessionItem = z.object({
  id: z.string(),
  userId: z.string(),
  user: sessionUser,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
  impersonatedBy: z.string().nullable(),
  activeOrganizationId: z.string().nullable(),
  activeTeamId: z.string().nullable(),
})

export const sessionHistoryOutput = {
  list: z.object({
    sessions: z.array(sessionItem),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
  }),
}
