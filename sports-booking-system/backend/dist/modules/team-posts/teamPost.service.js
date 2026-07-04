import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { teamPostRepository } from "./teamPost.repository.js";
function normalizeInput(userId, body) {
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
    listMine(userId) {
        return teamPostRepository.listMine(userId);
    },
    listJoined(userId) {
        return teamPostRepository.listJoined(userId);
    },
    async detail(id) {
        const [post] = await teamPostRepository.findById(id);
        if (!post)
            throw new NotFoundError("Khong tim thay bai dang tim dong doi");
        return post;
    },
    async create(userId, body) {
        const [post] = await teamPostRepository.create(normalizeInput(userId, body));
        if (!post)
            throw new NotFoundError("Khong the tao bai dang tim dong doi");
        return post;
    },
    async update(id, userId, body) {
        const [post] = await teamPostRepository.update(id, normalizeInput(userId, body));
        if (!post)
            throw new ForbiddenError("Ban chi co the sua bai dang cua minh");
        return post;
    },
    async delete(id, userId) {
        const count = await teamPostRepository.delete(id, userId);
        if (!count)
            throw new ForbiddenError("Ban chi co the xoa bai dang cua minh");
        return { deleted: true };
    },
    async join(id, userId) {
        const [post] = await teamPostRepository.join(id, userId);
        if (!post)
            throw new NotFoundError("Bai dang da day hoac khong con mo");
        realtimeService.toTeamPost(id, realtimeEvents.teamPostMemberJoined, post);
        return post;
    },
    async messages(id, userId) {
        const isMember = await teamPostRepository.isMember(id, userId);
        if (!isMember)
            throw new ForbiddenError("Ban can tham gia nhom de xem tin nhan");
        return teamPostRepository.listMessages(id);
    },
    async createMessage(id, userId, content) {
        const isMember = await teamPostRepository.isMember(id, userId);
        if (!isMember)
            throw new ForbiddenError("Ban can tham gia nhom de nhan tin");
        const [message] = await teamPostRepository.createMessage(id, userId, content.trim());
        if (!message)
            throw new NotFoundError("Khong the gui tin nhan");
        realtimeService.toTeamPost(id, realtimeEvents.teamPostMessageNew, message);
        return message;
    }
};
