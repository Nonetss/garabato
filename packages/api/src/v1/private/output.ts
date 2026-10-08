import { z } from "zod"

const userOutput = z
  .object({
    id: z.string().describe("The user's unique ID"),
    name: z.string().describe("The user's name"),
    email: z.string().describe("The user's email address"),
    emailVerified: z.boolean().describe("Whether the user's email is verified"),
    image: z
      .string()
      .nullable()
      .optional()
      .describe("The user's profile image, or null"),
    createdAt: z.date().describe("Timestamp when user was created"),
    updatedAt: z.date().describe("Timestamp when user was last updated"),
    role: z.string().nullable().optional().describe("The user's role"),
    banned: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether the user is banned"),
    banReason: z
      .string()
      .nullable()
      .optional()
      .describe("Reason for ban, if any"),
    banExpires: z
      .date()
      .nullable()
      .optional()
      .describe("Ban expiry timestamp, if any"),
  })
  .describe("The authenticated user")

export const privateOutput = {
  get: z.object({
    message: z.string().describe("A sample private message"),
    user: userOutput,
  }),
}
