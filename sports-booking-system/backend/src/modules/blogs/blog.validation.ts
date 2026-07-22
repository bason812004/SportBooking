import { z } from "zod";

// Flat schema — matches what the frontend sends (no body wrapper)
export const blogWriteSchema = z.object({
  title: z.string().trim().min(3).max(220),
  excerpt: z.string().trim().max(1000).nullable().optional(),
  content: z.string().trim().min(20),
  coverImageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  allowComments: z.boolean().default(true)
});

// For comment toggle — id from route params, allowComments from body
export const blogCommentsToggleSchema = z.object({
  id: z.string().min(1),
  allowComments: z.boolean()
});

// For comment CRUD — body-only (no params)
export const blogCommentSchema = z.object({
  content: z.string().trim().min(1).max(1000)
});

// Params for comment update/delete
export const blogCommentParamsSchema = z.object({
  slug: z.string().trim().min(1),
  commentId: z.string().min(1)  // was uuid() — changed to string to match varchar(20) PK
});

export const myBlogParamsSchema = z.object({
  id: z.string().min(1)
});

export const blogSlugParamsSchema = z.object({
  slug: z.string().trim().min(1)
});
