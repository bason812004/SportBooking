import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let blog: any;
let moved: number;
let removedComment: any;
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  blogForModeration: async () => blog,
  moderateBlog: async (id: string, status: string) => { calls.push(["moderate", id, status]); return moved; },
  hideBlog: async (id: string) => { calls.push(["hide", id]); return moved; },
  deleteBlogComment: async (postId: string, commentId: string) => { calls.push(["deleteComment", postId, commentId]); return removedComment; },
  addModerationHistory: async (entry: any) => { calls.push(["history", entry.entityType, entry.action, entry.reason]); return {}; }
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (_actor: string, action: string, _type: string, _id: string, metadata: any) => { calls.push(["audit", action, metadata]); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (notice: any) => { calls.push(["notify", notice.userId, notice.type, notice.content]); return {}; }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {}, toUsers: () => {} } } });
const { adminService } = await import("./admin.service.js");

beforeEach(() => {
  blog = { id: "bp1", authorId: "u1", title: "Sân mới", slug: "san-moi", status: "PENDING", visibility: "PUBLIC" };
  moved = 1;
  removedComment = { userId: "u2", content: "Spam link" };
  calls = [];
});

describe("admin blog moderation", () => {
  it("answers 404 for a post that does not exist and refuses private posts, which skip review", async () => {
    blog = null;
    await assert.rejects(adminService.moderateBlog("admin1", "nope", "PUBLISHED"), (error: any) => error.statusCode === 404);
    blog = { id: "bp1", authorId: "u1", title: "t", slug: "s", status: "PUBLISHED", visibility: "PRIVATE" };
    await assert.rejects(adminService.hideBlog("admin1", "bp1", "Lý do"), (error: any) => error.statusCode === 400);
    assert.deepEqual(calls, []);
  });

  it("says why a decision does not fit the post's status, and to reload when another admin just decided", async () => {
    blog = { ...blog, status: "PUBLISHED" };
    await assert.rejects(adminService.moderateBlog("admin1", "bp1", "REJECTED", "Lý do"), /Chỉ từ chối được bài đang chờ duyệt/);
    await assert.rejects(adminService.moderateBlog("admin1", "bp1", "PUBLISHED"), /đã được xuất bản/);
    blog = { ...blog, status: "PENDING" };
    await assert.rejects(adminService.hideBlog("admin1", "bp1", "Lý do"), /Chỉ ẩn được bài đang xuất bản/);
    moved = 0;
    await assert.rejects(adminService.moderateBlog("admin1", "bp1", "REJECTED", "Lý do"), (error: any) => error.statusCode === 409);
    assert.equal(calls.some((call) => call[0] === "notify"), false);
  });

  it("hides a published post with the reason recorded and sent to its author", async () => {
    blog = { ...blog, status: "PUBLISHED" };
    await adminService.hideBlog("admin1", "bp1", "Nội dung quảng cáo");
    assert.deepEqual(calls.slice(0, 2), [["hide", "bp1"], ["history", "BLOG", "HIDDEN", "Nội dung quảng cáo"]]);
    assert.match(String(calls.at(-1)![3]), /Lý do: Nội dung quảng cáo\./);
  });

  it("removes a comment with its content kept in the audit log, and tells the commenter why", async () => {
    blog = { ...blog, status: "PUBLISHED" };
    await adminService.removeBlogComment("admin1", "bp1", "bco1", "Spam.");
    assert.deepEqual(calls, [
      ["deleteComment", "bp1", "bco1"],
      ["history", "BLOG_COMMENT", "DELETED", "Spam."],
      ["audit", "BLOG_COMMENT_DELETED", { reason: "Spam.", postId: "bp1", userId: "u2", content: "Spam link" }],
      ["notify", "u2", "BLOG_COMMENT_REMOVED", "Quản trị viên đã xóa bình luận của bạn trong bài \"Sân mới\". Lý do: Spam."]
    ]);
    removedComment = null;
    await assert.rejects(adminService.removeBlogComment("admin1", "bp1", "gone", "Spam"), (error: any) => error.statusCode === 404);
  });
});
