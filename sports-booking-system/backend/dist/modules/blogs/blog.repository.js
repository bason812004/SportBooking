import { prisma } from "../../config/db.js";
export const blogRepository = {
    listPublished() {
        return prisma.$queryRaw `
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
      order by coalesce(b.published_at, b.created_at) desc
      limit 30
    `;
    },
    findPublishedBySlug(slug) {
        return prisma.$queryRaw `
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
    `;
    }
};
