import type { User } from "better-auth"

export interface UserRow extends User {
  role?: string
  banned: boolean | null
  banReason?: string | null
}
