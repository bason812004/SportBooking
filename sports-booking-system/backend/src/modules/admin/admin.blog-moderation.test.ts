import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
import { ValidationError } from "../../shared/errors/AppError.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let blog: any = null;
let changed = 1;
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  blogForModeration: async () => blog,
  moderateBlog: async () => changed,
  hideBlog: async () => changed,
  addModerationHistory: async () => ({})
} } });
mock.module("./admin.audit.js", { namedExports: { recordAdminAction: async () => ({}), verifyAuditChain: async () => ({}) } });
const notices: any[] = [];
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { create: async (n: any) => notices.push(n) } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService } = await import("./admin.service.js");

const post = (status: string) => ({ id: "b1", authorId: "author", title: "Kinh nghiệm chọn vợt", slug: "kinh-nghiem-abc", status });

describe("authors hear the moderation outcome", () => {
  it("publishing a pending post", async () => {
    blog = post("PENDING"); changed = 1; notices.length = 0;
    await adminService.moderateBlog("admin", "b1", "PUBLISHED");
    assert.deepEqual(notices.map((n) => [n.userId, n.type, n.title]), [["author", "BLOG_PUBLISHED", "Bài viết đã được duyệt"]]);
    assert.deepEqual(notices[0].metadata, { blogId: "b1", slug: "kinh-nghiem-abc" });
  });

  it("restoring a hidden post", async () => {
    blog = post("HIDDEN"); changed = 1; notices.length = 0;
    await adminService.moderateBlog("admin", "b1", "PUBLISHED");
    assert.equal(notices[0].title, "Bài viết đã được hiển thị lại");
  });

  it("rejecting and hiding say why and that the post can be resubmitted", async () => {
    blog = post("PENDING"); changed = 1; notices.length = 0;
    await adminService.moderateBlog("admin", "b1", "REJECTED", "Nội dung quảng cáo.");
    blog = post("PUBLISHED");
    await adminService.hideBlog("admin", "b1", "Vi phạm bản quyền");
    assert.deepEqual(notices.map((n) => n.type), ["BLOG_REJECTED", "BLOG_HIDDEN"]);
    assert.equal(notices[0].content, 'Bài "Kinh nghiệm chọn vợt" chưa được duyệt. Lý do: Nội dung quảng cáo. Bạn có thể sửa bài và gửi duyệt lại.');
    assert.match(notices[1].content, /đã bị ẩn khỏi trang blog\. Lý do: Vi phạm bản quyền\./);
  });

  it("no notice when nothing was moderated", async () => {
    blog = post("PUBLISHED"); changed = 0; notices.length = 0;
    await assert.rejects(adminService.moderateBlog("admin", "b1", "REJECTED"), ValidationError);
    assert.deepEqual(notices, []);
  });
});
