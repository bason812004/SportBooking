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
    c.is_edited as "isEdited",
    c.created_at as "createdAt",
    c.updated_at as "updatedAt",
    json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "user"
  from blog_comments c
  join users u on u.id = c.user_id
`;

const columnExistsCache = new Map<string, boolean>([
  ["blog_comments.is_edited", true],
  ["blog_posts.allow_comments", true]
]);

async function columnExists(tableName: string, columnName: string) {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
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
  } catch (err) {
    columnExistsCache.set(cacheKey, true);
    return true;
  }
}

async function ensureIsEditedColumn() {
  if (await columnExists("blog_comments", "is_edited")) return;

  await prisma.$executeRaw`
    alter table blog_comments
    add column if not exists is_edited boolean not null default false
  `;
  columnExistsCache.set("blog_comments.is_edited", true);
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

  async listByPost(postId: string) {
    await ensureIsEditedColumn();
    return prisma.$queryRawUnsafe<BlogCommentRow[]>(
      `
        ${selectComment}
        where c.post_id = $1
        order by c.created_at desc
      `,
      postId
    );
  },

  async findById(id: string) {
    await ensureIsEditedColumn();
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
    await ensureIsEditedColumn();
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
  },

  async update(id: string, content: string) {
    await ensureIsEditedColumn();
    const [updated] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        update blog_comments
        set content = $2,
            is_edited = true,
            updated_at = now()
        where id = $1
        returning id
      `,
      id,
      content
    );
    return updated?.id ? this.findById(updated.id) : [];
  },

  async delete(id: string) {
    await prisma.$executeRawUnsafe(
      `
        delete from blog_comments
        where id = $1
      `,
      id
    );
    return true;
  }
};
