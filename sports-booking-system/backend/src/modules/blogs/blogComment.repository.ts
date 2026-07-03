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

export const blogCommentRepository = {
  publishedPostBySlug(slug: string) {
    return prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        select id
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
