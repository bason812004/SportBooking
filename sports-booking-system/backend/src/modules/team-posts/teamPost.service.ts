import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
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

const ALLOWED_REACTIONS = new Set(["like", "love", "laugh", "wow", "sad", "clap", "fire"]);

function ensurePostCreator(post: { createdBy?: { id?: string | null } } | undefined | null, userId: string) {
  if (post?.createdBy?.id && post.createdBy.id === userId) return "OWNER";
  return null;
}

export const teamPostService = {
  list() {
    return teamPostRepository.list();
  },

  listMine(userId: string) {
    return teamPostRepository.listMine(userId);
  },

  listJoined(userId: string) {
    return teamPostRepository.listJoined(userId);
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
    realtimeService.toTeamPost(id, realtimeEvents.teamPostMemberRemoved, { postId: id });
    return { deleted: true };
  },

  async join(id: string, userId: string) {
    const [post] = await teamPostRepository.join(id, userId);
    if (!post) throw new NotFoundError("Bai dang da day hoac khong con mo");
    realtimeService.toTeamPost(id, realtimeEvents.teamPostMemberJoined, post);
    return post;
  },

  async members(id: string, userId: string) {
    const isMember = await teamPostRepository.isMember(id, userId);
    if (!isMember) throw new ForbiddenError("Ban can tham gia nhom de xem danh sach thanh vien");
    return teamPostRepository.listMembers(id);
  },

  async messages(id: string, userId: string) {
    const isMember = await teamPostRepository.isMember(id, userId);
    if (!isMember) throw new ForbiddenError("Ban can tham gia nhom de xem tin nhan");
    const messages = await teamPostRepository.listMessages(id);
    const reactions = await teamPostRepository.listReactionsForMessages(messages.map((m) => m.id));
    const grouped = new Map<string, Array<{ reaction: string; userId: string; createdAt: Date }>>();
    for (const reaction of reactions) {
      const list = grouped.get(reaction.messageId) ?? [];
      list.push({ reaction: reaction.reaction, userId: reaction.userId, createdAt: reaction.createdAt });
      grouped.set(reaction.messageId, list);
    }
    return messages.map((m) => ({ ...m, reactions: grouped.get(m.id) ?? [] }));
  },

  async createMessage(
    id: string,
    userId: string,
    payload: {
      content?: string;
      messageType?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: number;
      thumbnailUrl?: string;
      mimeType?: string;
    }
  ) {
    const isMember = await teamPostRepository.isMember(id, userId);
    if (!isMember) throw new ForbiddenError("Ban can tham gia nhom de nhan tin");

    const [message] = await teamPostRepository.createMessage(id, userId, {
      content: payload.content?.trim() || null,
      messageType: payload.messageType ?? "TEXT",
      attachmentUrl: payload.attachmentUrl || null,
      attachmentName: payload.attachmentName || null,
      attachmentSize: payload.attachmentSize ?? null,
      thumbnailUrl: payload.thumbnailUrl || null,
      mimeType: payload.mimeType || null
    });
    if (!message) throw new NotFoundError("Khong the gui tin nhan");
    realtimeService.toTeamPost(id, realtimeEvents.teamPostMessageNew, { ...message, reactions: [] });
    return message;
  },

  async reactToMessage(postId: string, userId: string, messageId: string, reaction: string) {
    if (!ALLOWED_REACTIONS.has(reaction)) throw new ValidationError("Reaction khong hop le");
    const isMember = await teamPostRepository.isMember(postId, userId);
    if (!isMember) throw new ForbiddenError("Ban can tham gia nhom de reaction");
    const belongs = await teamPostRepository.messageBelongsToPost(messageId, postId);
    if (!belongs) throw new NotFoundError("Khong tim thay tin nhan");

    const row = await teamPostRepository.upsertReaction(messageId, userId, reaction);
    realtimeService.toTeamPost(postId, realtimeEvents.teamPostReactionNew, {
      postId,
      messageId,
      userId,
      reaction: row.reaction,
      createdAt: row.createdAt
    });
    return row;
  },

  async removeReaction(postId: string, userId: string, messageId: string) {
    const isMember = await teamPostRepository.isMember(postId, userId);
    if (!isMember) throw new ForbiddenError("Ban can tham gia nhom de xoa reaction");
    await teamPostRepository.removeReaction(messageId, userId);
    realtimeService.toTeamPost(postId, realtimeEvents.teamPostReactionRemoved, {
      postId,
      messageId,
      userId
    });
    return { removed: true };
  },

  async leaveGroup(postId: string, userId: string) {
    const [post] = await teamPostRepository.findById(postId);
    if (!post) throw new NotFoundError("Khong tim thay bai dang");
    if (ensurePostCreator(post, userId) === "OWNER") {
      const adminCount = await teamPostRepository.countActiveAdmins(postId);
      if (adminCount <= 1) {
        throw new ValidationError("Ban la admin cuoi cung. Hay chuyen quyen admin hoac giai tan nhom truoc.");
      }
    }
    await teamPostRepository.leaveGroup(postId, userId);
    realtimeService.toTeamPost(postId, realtimeEvents.teamPostMemberLeft, { postId, userId });
    return { left: true };
  },

  async removeMember(postId: string, requesterId: string, targetUserId: string) {
    const [post] = await teamPostRepository.findById(postId);
    if (!post) throw new NotFoundError("Khong tim thay bai dang");
    const requesterRole = ensurePostCreator(post, requesterId) === "OWNER"
      ? "OWNER"
      : (await teamPostRepository.getMember(postId, requesterId))?.role;
    if (requesterRole !== "OWNER" && requesterRole !== "ADMIN") {
      throw new ForbiddenError("Chi admin nhom moi co the xoa thanh vien");
    }
    await teamPostRepository.removeMember(postId, targetUserId);
    realtimeService.toTeamPost(postId, realtimeEvents.teamPostMemberRemoved, {
      postId,
      userId: targetUserId
    });
    return { removed: true };
  },

  async transferAdmin(postId: string, requesterId: string, newAdminUserId: string) {
    const [post] = await teamPostRepository.findById(postId);
    if (!post) throw new NotFoundError("Khong tim thay bai dang");
    const requesterRole = ensurePostCreator(post, requesterId) === "OWNER"
      ? "OWNER"
      : (await teamPostRepository.getMember(postId, requesterId))?.role;
    if (requesterRole !== "OWNER" && requesterRole !== "ADMIN") {
      throw new ForbiddenError("Chi admin moi co the chuyen quyen");
    }
    const target = await teamPostRepository.getMember(postId, newAdminUserId);
    if (!target) throw new NotFoundError("Thanh vien khong ton tai trong nhom");

    await teamPostRepository.updateMemberRole(postId, newAdminUserId, "ADMIN");
    realtimeService.toTeamPost(postId, realtimeEvents.teamPostAdminTransferred, {
      postId,
      newAdminUserId
    });
    return { transferred: true };
  }
};
