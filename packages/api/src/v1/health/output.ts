import { z } from "zod"

export const healthOutput = {
  check: z.literal("OK").describe("OK when the server is up and reachable"),
}
