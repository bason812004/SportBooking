import { NotFoundError } from "../../shared/errors/AppError.js";
import { blogCommentRepository } from "./blogComment.repository.js";

async function requirePublishedPost(slug: string) {
  const [post] = await blogCommentRepository.publishedPostBySlug(slug);
  if (!post) throw new NotFoundError("Khong tim thay bai viet");
  return post;
}

export const blogCommentService = {
  async list(slug: string) {
    const post = await requirePublishedPost(slug);
    return blogCommentRepository.listByPost(post.id);
  },

  async create(slug: string, userId: string, content: string) {
    const post = await requirePublishedPost(slug);
    const [comment] = await blogCommentRepository.create(post.id, userId, content);
    if (!comment) throw new NotFoundError("Khong the tao binh luan");
    return comment;
  }
};
