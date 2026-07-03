import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";
import { teamPostRepository, type TeamPostInput } from "./teamPost.repository.js";

type BodyInput = Omit<TeamPostInput, "userId">;

function normalizeInput(userId: string, body: BodyInput): TeamPostInput {
  return {
    ...body,
    userId,
    courtId: body.courtId || null,
    playingDate: body.playingDate || null,
    extraServices: body.extraServices || null,
    note: body.note || null,
    zaloGroupLink: body.zaloGroupLink || null,
    zaloQrImage: body.zaloQrImage || null
  };
}

export const teamPostService = {
  list() {
    return teamPostRepository.list();
  },

  listMine(userId: string) {
    return teamPostRepository.listMine(userId);
  },

  async detail(id: string) {
    const [post] = await teamPostRepository.findById(id);
    if (!post) throw new NotFoundError("Khong tim thay bai dang tim dong doi");
    return post;
  },

  async create(userId: string, body: BodyInput) {
    const [post] = await teamPostRepository.create(normalizeInput(userId, body));
    if (!post) throw new NotFoundError("Khong the tao bai dang tim dong doi");
    return post;
  },

  async update(id: string, userId: string, body: BodyInput) {
    const [post] = await teamPostRepository.update(id, normalizeInput(userId, body));
    if (!post) throw new ForbiddenError("Ban chi co the sua bai dang cua minh");
    return post;
  },

  async delete(id: string, userId: string) {
    const count = await teamPostRepository.delete(id, userId);
    if (!count) throw new ForbiddenError("Ban chi co the xoa bai dang cua minh");
    return { deleted: true };
  },

  async join(id: string) {
    const [post] = await teamPostRepository.join(id);
    if (!post) throw new NotFoundError("Bai dang da day hoac khong con mo");
    return post;
  }
};
