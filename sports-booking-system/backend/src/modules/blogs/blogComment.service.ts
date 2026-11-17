import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { blogCommentRepository } from "./blogComment.repository.js";

async function requirePublishedPost(slug: string) {
  const [post] = await blogCommentRepository.publishedPostBySlug(slug);
  if (!post) throw new NotFoundError("Khong tim thay bai viet");
  return post;
}

/** The comment must belong to the post in the URL, so a post author cannot reach comments elsewhere. */
async function requireCommentOf(postId: string, commentId: string) {
  const [comment] = await blogCommentRepository.findById(commentId);
  if (!comment || comment.postId !== postId) throw new NotFoundError("Khong tim thay binh luan");
  return comment;
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

  /** Only the commenter rewords a comment; nobody else, an admin included, puts words in their mouth. */
  async update(slug: string, commentId: string, userId: string, content: string) {
    const post = await requirePublishedPost(slug);
    const comment = await requireCommentOf(post.id, commentId);

    if (comment.user.id !== userId) {
      throw new ForbiddenError("Bạn không có quyền chỉnh sửa bình luận này");
    }

    const [updated] = await blogCommentRepository.update(commentId, content);
    if (!updated) throw new NotFoundError("Khong the cap nhat binh luan");
    return updated;
  },

  /**
   * The commenter or the post's author (moderating their own post) removes a comment here. Admins remove comments
   * from the moderation page, with a reason the commenter is told and an audit entry.
   */
  async delete(slug: string, commentId: string, userId: string) {
    const post = await requirePublishedPost(slug);
    const comment = await requireCommentOf(post.id, commentId);

    if (comment.user.id !== userId && post.authorId !== userId) {
      throw new ForbiddenError("Bạn không có quyền xóa bình luận này");
    }

    await blogCommentRepository.delete(commentId);
    return { deleted: true };
  }
};
