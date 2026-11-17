import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { savedBlogStatus, submittableBlogStatuses, type BlogStatus } from "./blog.calculations.js";
import { blogRepository, type BlogListSort } from "./blog.repository.js";

type BlogBody = {
  title: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  allowComments?: boolean;
  submit?: boolean;
};

/** What a save does when the request does not say: users submit right away, partners keep a draft first. */
export type BlogSaveDefaults = { submit: boolean };

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

function writeFields(body: BlogBody) {
  return {
    title: body.title,
    excerpt: body.excerpt || null,
    content: body.content,
    coverImageUrl: body.coverImageUrl || null,
    visibility: body.visibility,
    allowComments: body.allowComments ?? true
  };
}

/** One lifecycle for every author's posts; used by /blogs/me (users) and /partner/blogs (partners). */
export const blogService = {
  list(query: { search?: string; sort?: BlogListSort; page?: number; limit?: number } = {}) {
    return blogRepository.listPublished({ ...query, search: query.search || undefined });
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

  async createMine(userId: string, body: BlogBody, defaults: BlogSaveDefaults) {
    const status = savedBlogStatus(null, body.visibility, body.submit ?? defaults.submit);
    const [post] = await blogRepository.createMine(userId, { ...writeFields(body), slug: slugFor(body.title) }, status);
    if (!post) throw new NotFoundError("Khong the tao bai viet");
    // Submitting (PENDING) makes the database trigger queue the admin notice in the same statement.
    return post;
  },

  /** Any of the author's posts can be edited; a non-draft edit goes back to review (see savedBlogStatus). */
  async updateMine(id: string, userId: string, body: BlogBody, defaults: BlogSaveDefaults) {
    const current = await this.detailMine(id, userId);
    const status = savedBlogStatus(current.status as BlogStatus, body.visibility, body.submit ?? defaults.submit);
    const [post] = await blogRepository.updateMine(id, userId, writeFields(body), status);
    if (!post) throw new NotFoundError("Khong the cap nhat bai viet");
    return post;
  },

  /** Sends a draft, or a rejected post, (back) for review as it is. */
  async submitMine(id: string, userId: string) {
    const current = await this.detailMine(id, userId);
    const from = current.status as BlogStatus;
    if (!submittableBlogStatuses.includes(from)) throw new ValidationError("Chi gui duyet duoc bai nhap hoac bai bi tu choi");
    const to = savedBlogStatus(from, current.visibility as "PUBLIC" | "PRIVATE", true);
    if (!(await blogRepository.setMineStatus(id, userId, from, to))) throw new ValidationError("Bai viet vua thay doi, vui long tai lai");
    return this.detailMine(id, userId);
  },

  async updateMineComments(id: string, userId: string, allowComments: boolean) {
    await this.detailMine(id, userId);
    const [post] = await blogRepository.updateMineComments(id, userId, allowComments);
    if (!post) throw new NotFoundError("Khong the cap nhat binh luan");
    return post;
  },

  /** Authors may delete their own post in any status; its comments and likes go with it. */
  async deleteMine(id: string, userId: string) {
    const count = await blogRepository.deleteMine(id, userId);
    if (!count) throw new NotFoundError("Khong tim thay bai viet cua ban");
    return { deleted: true };
  }
};
