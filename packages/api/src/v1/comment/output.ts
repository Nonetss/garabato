import { z } from "zod"

const author = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
})

const commentBase = z.object({
  id: z.uuid(),
  content: z.string(),
  entityType: z.string(),
  entityId: z.uuid(),
  parentId: z.uuid().nullable(),
  author: author,
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CommentNode = z.infer<typeof commentBase> & {
  replies: CommentNode[]
}

const commentNode: z.ZodType<CommentNode> = commentBase.extend({
  replies: z.lazy(() => z.array(commentNode)),
})

export const commentOutput = {
  list: z.array(commentNode).describe("Top-level comments with nested replies"),

  counts: z.array(
    z.object({
      entityType: z.string(),
      entityId: z.uuid(),
      count: z.number().int().nonnegative(),
    })
  ),

  create: commentBase.extend({ replies: z.array(commentNode).default([]) }),
  update: commentBase.extend({ replies: z.array(commentNode).default([]) }),
  delete: z.object({
    id: z.uuid(),
    success: z.boolean(),
  }),
}
