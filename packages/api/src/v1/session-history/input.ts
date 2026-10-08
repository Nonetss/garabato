import { z } from "zod"

import { paginationCursor, paginationLimit } from "#shared/pagination"

export const sessionHistoryInput = {
  list: z.object({
    limit: paginationLimit(25, 100),
    cursor: paginationCursor(),
  }),
}
