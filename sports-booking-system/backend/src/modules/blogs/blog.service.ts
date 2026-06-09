import { NotFoundError } from "../../shared/errors/AppError.js";
import { blogRepository } from "./blog.repository.js";

export const blogService = {
  list() {
    return blogRepository.listPublished();
  },

  async detail(slug: string) {
    const [post] = await blogRepository.findPublishedBySlug(slug);
    if (!post) throw new NotFoundError("Khong tim thay bai viet");
    return post;
  }
};
