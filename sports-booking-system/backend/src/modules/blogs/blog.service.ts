import { NotFoundError } from "../../shared/errors/AppError.js";
import { blogRepository } from "./blog.repository.js";

type BlogBody = {
  title: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  allowComments?: boolean;
};

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "bai-viet";
}

function slugFor(title: string, suffix?: string) {
  return `${slugify(title)}-${suffix ?? Math.random().toString(36).slice(2, 8)}`;
}

export const blogService = {
  list(query?: { search?: unknown }) {
    const search = typeof query?.search === "string" ? query.search.trim().slice(0, 160) : undefined;
    return blogRepository.listPublished(search || undefined);
  },

  async detail(slug: string) {
    await blogRepository.incrementViewCount(slug);
    const [post] = await blogRepository.findPublishedBySlug(slug);
    if (!post) throw new NotFoundError("Khong tim thay bai viet");
    return post;
  },

  listMine(userId: string) {
    return blogRepository.listMine(userId);
  },

  async detailMine(id: string, userId: string) {
    const [post] = await blogRepository.findMineById(id, userId);
    if (!post) throw new NotFoundError("Khong tim thay bai viet cua ban");
    return post;
  },

  async createMine(userId: string, body: BlogBody) {
    const [post] = await blogRepository.createMine(userId, {
      ...body,
      slug: slugFor(body.title),
      excerpt: body.excerpt || null,
      coverImageUrl: body.coverImageUrl || null,
      allowComments: body.allowComments ?? true
    });
    if (!post) throw new NotFoundError("Khong the tao bai viet");
    return post;
  },

  async updateMine(id: string, userId: string, body: BlogBody) {
    await this.detailMine(id, userId);
    const [post] = await blogRepository.updateMine(id, userId, {
      ...body,
      slug: slugFor(body.title, id),
      excerpt: body.excerpt || null,
      coverImageUrl: body.coverImageUrl || null,
      allowComments: body.allowComments ?? true
    });
    if (!post) throw new NotFoundError("Khong the cap nhat bai viet");
    return post;
  },

  async updateMineComments(id: string, userId: string, allowComments: boolean) {
    await this.detailMine(id, userId);
    const [post] = await blogRepository.updateMineComments(id, userId, allowComments);
    if (!post) throw new NotFoundError("Khong the cap nhat binh luan");
    return post;
  },

  async deleteMine(id: string, userId: string) {
    const count = await blogRepository.deleteMine(id, userId);
    if (!count) throw new NotFoundError("Khong tim thay bai viet cua ban");
    return { deleted: true };
  }
};
