import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  viewCount: number;
  allowComments: boolean;
  category: { id: string; name: string; slug: string } | null;
  author: { id: string; fullName: string; avatarUrl: string | null };
};

export type BlogWriteInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  allowComments: boolean;
};

const blogRowSelect = (
  viewCountSelect: Prisma.Sql = Prisma.sql`0::int`,
  allowCommentsSelect: Prisma.Sql = Prisma.sql`true`
) => Prisma.sql`
  select
    b.id,
    b.title,
    b.slug,
    b.excerpt,
    b.content,
    b.cover_image_url as "coverImageUrl",
    b.status::text as "status",
    b.visibility::text as "visibility",
    b.created_at as "createdAt",
    b.updated_at as "updatedAt",
    b.published_at as "publishedAt",
    ${viewCountSelect} as "viewCount",
    ${allowCommentsSelect} as "allowComments",
    case
      when bc.id is null then null
      else json_build_object('id', bc.id, 'name', bc.name, 'slug', bc.slug)
    end as "category",
    json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "author"
  from blog_posts b
  join users u on u.id = b.author_id
  left join blog_categories bc on bc.id = b.category_id
`;

const vietnameseAccentedChars =
  "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ" +
  "ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ";

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const vietnamesePlainChars = normalizeSearchText(vietnameseAccentedChars);

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
  if (exists) columnExistsCache.set(cacheKey, true);
  return exists;
}

async function ensureAllowCommentsColumn() {
  if (await columnExists("blog_posts", "allow_comments")) return;

  await prisma.$executeRaw`
    alter table blog_posts
    add column if not exists allow_comments boolean not null default true
  `;
  columnExistsCache.set("blog_posts.allow_comments", true);
}

export const blogRepository = {
  async listPublished(search?: string) {
    const hasViewCount = await columnExists("blog_posts", "view_count");
    const hasAllowComments = await columnExists("blog_posts", "allow_comments");
    const viewCountSelect = hasViewCount ? Prisma.sql`coalesce(b.view_count, 0)::int` : Prisma.sql`0::int`;
    const allowCommentsSelect = hasAllowComments ? Prisma.sql`coalesce(b.allow_comments, true)` : Prisma.sql`true`;
    const orderBy = hasViewCount
      ? Prisma.sql`coalesce(b.view_count, 0) desc, coalesce(b.published_at, b.created_at) desc`
      : Prisma.sql`coalesce(b.published_at, b.created_at) desc`;
    const pattern = search ? `%${search}%` : null;
    const normalizedPattern = search ? `%${normalizeSearchText(search)}%` : null;

    return prisma.$queryRaw<BlogPostRow[]>(Prisma.sql`
      ${blogRowSelect(viewCountSelect, allowCommentsSelect)}
      where b.status = 'PUBLISHED'::blog_post_status
        and b.visibility = 'PUBLIC'::blog_visibility
        and (
          ${pattern}::text is null
          or b.title ilike ${pattern}
          or u.full_name ilike ${pattern}
          or lower(translate(b.title, ${vietnameseAccentedChars}, ${vietnamesePlainChars})) like ${normalizedPattern}
          or lower(translate(u.full_name, ${vietnameseAccentedChars}, ${vietnamesePlainChars})) like ${normalizedPattern}
        )
      order by ${orderBy}
      limit 30
    `);
  },

  async findPublishedBySlug(slug: string) {
    const hasViewCount = await columnExists("blog_posts", "view_count");
    const hasAllowComments = await columnExists("blog_posts", "allow_comments");
    const viewCountSelect = hasViewCount ? Prisma.sql`coalesce(b.view_count, 0)::int` : Prisma.sql`0::int`;
    const allowCommentsSelect = hasAllowComments ? Prisma.sql`coalesce(b.allow_comments, true)` : Prisma.sql`true`;

    return prisma.$queryRaw<BlogPostRow[]>(Prisma.sql`
      ${blogRowSelect(viewCountSelect, allowCommentsSelect)}
      where b.slug = ${slug}
        and b.status = 'PUBLISHED'::blog_post_status
        and b.visibility = 'PUBLIC'::blog_visibility
      limit 1
    `);
  },

  async incrementViewCount(slug: string) {
    if (!(await columnExists("blog_posts", "view_count"))) return 0;

    return prisma.$executeRaw`
      update blog_posts
      set view_count = coalesce(view_count, 0) + 1,
          updated_at = now()
      where slug = ${slug}
        and status = 'PUBLISHED'::blog_post_status
        and visibility = 'PUBLIC'::blog_visibility
    `;
  },

  async listMine(userId: string) {
    const hasViewCount = await columnExists("blog_posts", "view_count");
    const hasAllowComments = await columnExists("blog_posts", "allow_comments");
    const viewCountSelect = hasViewCount ? Prisma.sql`coalesce(b.view_count, 0)::int` : Prisma.sql`0::int`;
    const allowCommentsSelect = hasAllowComments ? Prisma.sql`coalesce(b.allow_comments, true)` : Prisma.sql`true`;

    return prisma.$queryRaw<BlogPostRow[]>(Prisma.sql`
      ${blogRowSelect(viewCountSelect, allowCommentsSelect)}
      where b.author_id = ${userId}
      order by b.updated_at desc, b.created_at desc
      limit 100
    `);
  },

  async findMineById(id: string, userId: string) {
    const hasViewCount = await columnExists("blog_posts", "view_count");
    const hasAllowComments = await columnExists("blog_posts", "allow_comments");
    const viewCountSelect = hasViewCount ? Prisma.sql`coalesce(b.view_count, 0)::int` : Prisma.sql`0::int`;
    const allowCommentsSelect = hasAllowComments ? Prisma.sql`coalesce(b.allow_comments, true)` : Prisma.sql`true`;

    return prisma.$queryRaw<BlogPostRow[]>(Prisma.sql`
      ${blogRowSelect(viewCountSelect, allowCommentsSelect)}
      where b.id = ${id}
        and b.author_id = ${userId}
      limit 1
    `);
  },

  async createMine(userId: string, input: BlogWriteInput) {
    await ensureAllowCommentsColumn();

    const [inserted] = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      insert into blog_posts (author_id, title, slug, excerpt, content, cover_image_url, visibility, status, allow_comments, published_at)
      values (
        ${userId},
        ${input.title},
        ${input.slug},
        ${input.excerpt ?? null},
        ${input.content},
        ${input.coverImageUrl || null},
        ${input.visibility}::blog_visibility,
        'PENDING'::blog_post_status,
        ${input.allowComments},
        null
      )
      returning id
    `);
    return inserted?.id ? this.findMineById(inserted.id, userId) : [];
  },

  async updateMine(id: string, userId: string, input: BlogWriteInput) {
    await ensureAllowCommentsColumn();

    const [updated] = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      update blog_posts
      set title = ${input.title},
          slug = ${input.slug},
          excerpt = ${input.excerpt ?? null},
          content = ${input.content},
          cover_image_url = ${input.coverImageUrl || null},
          visibility = ${input.visibility}::blog_visibility,
          allow_comments = ${input.allowComments},
          status = 'PENDING'::blog_post_status,
          published_at = null,
          updated_at = now()
      where id = ${id}
        and author_id = ${userId}
      returning id
    `);
    return updated?.id ? this.findMineById(updated.id, userId) : [];
  },

  async updateMineComments(id: string, userId: string, allowComments: boolean) {
    await ensureAllowCommentsColumn();

    const [updated] = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      update blog_posts
      set allow_comments = ${allowComments},
          updated_at = now()
      where id = ${id}
        and author_id = ${userId}
      returning id
    `);
    return updated?.id ? this.findMineById(updated.id, userId) : [];
  },

  deleteMine(id: string, userId: string) {
    return prisma.$executeRaw`
      delete from blog_posts
      where id = ${id}
        and author_id = ${userId}
    `;
  }
};
