import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { ForbiddenError } from "../../shared/errors/AppError.js";
import { vietnamNow } from "../../shared/utils/time.js";

const removedIds: string[] = [];
mock.module("./teamPost.repository.js", { namedExports: { teamPostRepository: {
  delete: async (id: string, userId: string) => (userId === "owner" ? 1 : 0),
  deleteAny: async (id: string) => { removedIds.push(id); return { userId: "owner", title: "Đá bóng tối thứ 6" }; }
} } });
const audits: any[] = [];
mock.module("../admin/admin.audit.js", { namedExports: { recordAdminAction: async (...args: any[]) => audits.push(args) } });
const notices: any[] = [];
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { create: async (n: any) => notices.push(n) } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toTeamPost: () => {} } } });
const { teamPostService } = await import("./teamPost.service.js");
const { teamPostSchema } = await import("./teamPost.validation.js");

const post = {
  title: "Đá bóng", sportType: "Bóng đá", courtName: "Sân A", address: "Hà Nội",
  currentPlayers: 3, maxPlayers: 10, startTime: "18:00", endTime: "19:30", pricePerPerson: 50000
};

describe("team post moderation", () => {
  it("an admin can remove any post; the owner is told and the removal is audited", async () => {
    await teamPostService.delete("tp1", { id: "admin", role: "ADMIN" });
    assert.deepEqual(removedIds, ["tp1"]);
    assert.deepEqual(audits[0].slice(0, 4), ["admin", "TEAM_POST_REMOVED", "TEAM_POST", "tp1"]);
    assert.deepEqual(notices.map((n) => [n.userId, n.type]), [["owner", "TEAM_POST_REMOVED"]]);
  });

  it("other users can still only delete their own post", async () => {
    assert.deepEqual(await teamPostService.delete("tp1", { id: "owner", role: "USER" }), { deleted: true });
    await assert.rejects(teamPostService.delete("tp1", { id: "stranger", role: "USER" }), ForbiddenError);
  });

  it("a playing date in the past is rejected; today (Vietnam) is fine", () => {
    assert.equal(teamPostSchema.safeParse({ body: { ...post, playingDate: "2020-01-01" } }).success, false);
    assert.equal(teamPostSchema.safeParse({ body: { ...post, playingDate: vietnamNow().date } }).success, true);
    assert.equal(teamPostSchema.safeParse({ body: post }).success, true);
  });
});
