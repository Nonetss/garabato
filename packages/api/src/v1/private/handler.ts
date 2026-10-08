import type { Context } from "#context"

export const privateHandler = {
  getPrivateData: async ({ context }: { context: Context }) => {
    const { user } = context
    if (!user) {
      throw new Error("User is required")
    }

    return {
      message: "This is private",
      user,
    }
  },
}
