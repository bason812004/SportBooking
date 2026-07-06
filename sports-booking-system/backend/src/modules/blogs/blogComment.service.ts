import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
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
    if (!post.allowComments) throw new ValidationError("Bai viet da tat binh luan");
    const [comment] = await blogCommentRepository.create(post.id, userId, content);
    if (!comment) throw new NotFoundError("Khong the tao binh luan");
    return comment;
  },

  async update(slug: string, commentId: string, userId: string, role: string, content: string) {
    await requirePublishedPost(slug);
    const [comment] = await blogCommentRepository.findById(commentId);
    if (!comment) throw new NotFoundError("Khong tim thay binh luan");

    if (comment.user.id !== userId && role !== "ADMIN") {
      throw new ValidationError("Ban khong co quyen chinh sua binh luan nay");
    }

    const [updated] = await blogCommentRepository.update(commentId, content);
    if (!updated) throw new NotFoundError("Khong the cap nhat binh luan");
    return updated;
  },

  async delete(slug: string, commentId: string, userId: string, role: string) {
    await requirePublishedPost(slug);
    const [comment] = await blogCommentRepository.findById(commentId);
    if (!comment) throw new NotFoundError("Khong tim thay binh luan");

    if (comment.user.id !== userId && role !== "ADMIN") {
      throw new ValidationError("Ban khong co quyen xoa binh luan nay");
    }

    await blogCommentRepository.delete(commentId);
    return { deleted: true };
  }
};
