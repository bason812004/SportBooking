import { prisma } from "../../config/db.js";

export type BlogCommentRow = {
  id: string;
  postId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; fullName: string; avatarUrl: string | null };
};

const selectComment = `
  select
    c.id,
    c.post_id as "postId",
    c.content,
    c.created_at as "createdAt",
    c.updated_at as "updatedAt",
    json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "user"
  from blog_comments c
  join users u on u.id = c.user_id
`;

const columnExistsCache = new Map<string, boolean>();

async function columnExists(tableName: string, columnName: string) {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const [row] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    select exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as "exists"
  `;
  const exists = Boolean(row?.exists);
  columnExistsCache.set(cacheKey, exists);
  return exists;
}

export const blogCommentRepository = {
  async publishedPostBySlug(slug: string) {
    const allowCommentsSelect = await columnExists("blog_posts", "allow_comments")
      ? "coalesce(allow_comments, true)"
      : "true";

    return prisma.$queryRawUnsafe<Array<{ id: string; allowComments: boolean }>>(
      `
        select id, ${allowCommentsSelect} as "allowComments"
        from blog_posts
        where slug = $1
          and status = 'PUBLISHED'::blog_post_status
          and visibility = 'PUBLIC'::blog_visibility
        limit 1
      `,
      slug
    );
  },

  listByPost(postId: string) {
    return prisma.$queryRawUnsafe<BlogCommentRow[]>(
      `
        ${selectComment}
        where c.post_id = $1
        order by c.created_at desc
      `,
      postId
    );
  },

  findById(id: string) {
    return prisma.$queryRawUnsafe<BlogCommentRow[]>(
      `
        ${selectComment}
        where c.id = $1
        limit 1
      `,
      id
    );
  },

  async create(postId: string, userId: string, content: string) {
    const [inserted] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        insert into blog_comments (post_id, user_id, content)
        values ($1, $2, $3)
        returning id
      `,
      postId,
      userId,
      content
    );
    return inserted?.id ? this.findById(inserted.id) : [];
  }
};
