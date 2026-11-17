import { z } from "zod";

// Shared by /blogs/me (users) and /partner/blogs (partners): every author follows the same rules.
export const blogWriteSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(220),
    excerpt: z.string().trim().max(1000).nullable().optional(),
    content: z.string().trim().min(20).max(50000),
    coverImageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
    allowComments: z.boolean().default(true),
    // Send for review when saving. Omitted: users submit right away, partners keep a draft first.
    submit: z.boolean().optional()
  })
});

export const blogListQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(160).optional(),
    sort: z.enum(["newest", "oldest", "views"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(30)
  })
});

export const blogCommentsToggleSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    allowComments: z.boolean()
  })
});

export const myBlogParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const blogSlugParamsSchema = z.object({
  params: z.object({ slug: z.string().trim().min(1) })
});

export const blogCommentSchema = z.object({
  params: z.object({ slug: z.string().trim().min(1) }),
  body: z.object({
    content: z.string().trim().min(1).max(1000)
  })
});

export const blogCommentParamsSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1),
    commentId: z.string().trim().min(1).max(40)
  })
});
