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
  publishedAt: Date | null;
  viewCount: number;
  category: { id: string; name: string; slug: string } | null;
  author: { id: string; fullName: string; avatarUrl: string | null };
};

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

export const blogRepository = {
  async listPublished() {
    const hasViewCount = await columnExists("blog_posts", "view_count");
    const viewCountSelect = hasViewCount ? Prisma.sql`coalesce(b.view_count, 0)::int` : Prisma.sql`0::int`;
    const orderBy = hasViewCount
      ? Prisma.sql`coalesce(b.view_count, 0) desc, coalesce(b.published_at, b.created_at) desc`
      : Prisma.sql`coalesce(b.published_at, b.created_at) desc`;

    return prisma.$queryRaw<BlogPostRow[]>(Prisma.sql`
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
        b.published_at as "publishedAt",
        ${viewCountSelect} as "viewCount",
        case
          when bc.id is null then null
          else json_build_object('id', bc.id, 'name', bc.name, 'slug', bc.slug)
        end as "category",
        json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "author"
      from blog_posts b
      join users u on u.id = b.author_id
      left join blog_categories bc on bc.id = b.category_id
      where b.status = 'PUBLISHED'::blog_post_status
        and b.visibility = 'PUBLIC'::blog_visibility
      order by ${orderBy}
      limit 30
    `);
  },

  async findPublishedBySlug(slug: string) {
    const hasViewCount = await columnExists("blog_posts", "view_count");
    const viewCountSelect = hasViewCount ? Prisma.sql`coalesce(b.view_count, 0)::int` : Prisma.sql`0::int`;

    return prisma.$queryRaw<BlogPostRow[]>(Prisma.sql`
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
        b.published_at as "publishedAt",
        ${viewCountSelect} as "viewCount",
        case
          when bc.id is null then null
          else json_build_object('id', bc.id, 'name', bc.name, 'slug', bc.slug)
        end as "category",
        json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "author"
      from blog_posts b
      join users u on u.id = b.author_id
      left join blog_categories bc on bc.id = b.category_id
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
  }
};
