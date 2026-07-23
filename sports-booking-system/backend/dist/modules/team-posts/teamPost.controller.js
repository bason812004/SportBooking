import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { teamPostService } from "./teamPost.service.js";
export const teamPostController = {
    list: asyncHandler(async (_req, res) => sendSuccess(res, await teamPostService.list())),
    listMine: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.listMine(req.user.id))),
    listJoined: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.listJoined(req.user.id))),
    detail: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.detail(req.params.id))),
    create: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.create(req.user.id, req.body), 201)),
    update: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.update(req.params.id, req.user.id, req.body))),
    delete: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.delete(req.params.id, req.user.id))),
    join: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.join(req.params.id, req.user.id))),
    members: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.members(req.params.id, req.user.id))),
    messages: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.messages(req.params.id, req.user.id))),
    createMessage: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.createMessage(req.params.id, req.user.id, req.body), 201)),
    reactMessage: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.reactToMessage(req.params.id, req.user.id, req.body.messageId, req.body.reaction))),
    removeReaction: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.removeReaction(req.params.id, req.user.id, req.params.messageId))),
    leaveGroup: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.leaveGroup(req.params.id, req.user.id))),
    removeMember: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.removeMember(req.params.id, req.user.id, req.params.memberId))),
    transferAdmin: asyncHandler(async (req, res) => sendSuccess(res, await teamPostService.transferAdmin(req.params.id, req.user.id, req.body.newAdminUserId)))
};
