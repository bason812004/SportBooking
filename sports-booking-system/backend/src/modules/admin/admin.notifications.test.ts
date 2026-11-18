import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let campaign: any;
let recalled: string[] | null;
let recipients: Array<{ id: string }>;
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  notificationCampaignDetail: async () => campaign,
  campaignRecipientIds: async (input: any, actorId: string) => { calls.push(["audience", input, actorId]); return recipients; },
  createNotificationCampaign: async (actorId: string, input: any) => {
    calls.push(["create", input]);
    return recipients.length ? { campaign: { id: "nc9", title: input.title, content: input.content, type: input.type, recipientCount: recipients.length }, recipientIds: recipients.map((r) => r.id) } : null;
  },
  recallNotificationCampaign: async (id: string, actorId: string, reason: string) => { calls.push(["recall", id, actorId, reason]); return recalled; }
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (_actor: string, action: string, _type: string, _id: string, metadata: any) => { calls.push(["audit", action, metadata]); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {
  toUsers: (ids: string[], _event: string, payload: any) => calls.push(["realtime", ids, payload]),
  toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {}
} } });
const { adminService } = await import("./admin.service.js");
const { notificationCampaignCreateSchema } = await import("./admin.validation.js");

beforeEach(() => {
  campaign = { id: "nc1", recalledAt: null, readCount: 3 };
  recalled = ["u1", "u2"];
  recipients = [{ id: "u1" }, { id: "u2" }];
  calls = [];
});

describe("admin notification campaigns", () => {
  it("counts the audience from the target fields that apply only", async () => {
    const result = await adminService.notificationAudience("admin1", { targetType: "ROLE", targetRole: "RECIPIENT", targetUserId: "u7" });
    assert.deepEqual(result, { count: 2 });
    assert.deepEqual(calls[0], [
      "audience",
      { targetType: "ROLE", targetRole: "RECIPIENT", targetUserId: undefined, targetPartnerId: undefined, targetUserIds: undefined },
      "admin1"
    ]);
  });

  it("sends to accounts picked one by one once each, and keeps who they were in the audit entry", async () => {
    const campaignSent = await adminService.createNotificationCampaign("admin1", {
      title: "Sân tạm đóng",
      content: "Sân A bảo trì sáng mai",
      type: "MAINTENANCE",
      targetType: "USERS",
      targetUserIds: ["u1", "u2", "u1"],
      targetRole: "USER"
    });
    assert.equal(campaignSent.recipientCount, 2);
    const created = calls.find((call) => call[0] === "create")![1] as any;
    assert.deepEqual(created.targetUserIds, ["u1", "u2"]);
    assert.equal(created.targetRole, undefined);
    const audit = calls.find((call) => call[0] === "audit")!;
    assert.equal(audit[1], "NOTIFICATION_CAMPAIGN_SENT");
    assert.deepEqual((audit[2] as any).targetUserIds, ["u1", "u2"]);
    assert.deepEqual(calls.find((call) => call[0] === "realtime")![1], ["u1", "u2"]);

    recipients = [];
    await assert.rejects(
      adminService.createNotificationCampaign("admin1", { title: "Sân tạm đóng", content: "Mai", type: "MAINTENANCE", targetType: "USERS", targetUserIds: ["u9"] }),
      /các tài khoản đã chọn/
    );
  });

  it("accepts picked accounts and court staff as audiences, and wants the accounts when USERS is picked", async () => {
    const base = { title: "Bảo trì", content: "Tối nay", type: "MAINTENANCE" };
    assert.equal(notificationCampaignCreateSchema.safeParse({ body: { ...base, targetType: "USERS", targetUserIds: ["u1", "u2"] } }).success, true);
    assert.equal(notificationCampaignCreateSchema.safeParse({ body: { ...base, targetType: "ROLE", targetRole: "RECIPIENT" } }).success, true);
    assert.equal(notificationCampaignCreateSchema.safeParse({ body: { ...base, targetType: "USERS" } }).success, false);
    assert.equal(notificationCampaignCreateSchema.safeParse({ body: { ...base, targetType: "USERS", targetUserIds: [] } }).success, false);
  });

  it("explains an empty audience: a locked or missing account, or a group with nobody in it", async () => {
    recipients = [];
    await assert.rejects(
      adminService.createNotificationCampaign("admin1", { title: "Bảo trì", content: "Tối nay", type: "MAINTENANCE", targetType: "USER", targetUserId: "u404" }),
      /không tồn tại hoặc đang bị khóa/
    );
    await assert.rejects(
      adminService.createNotificationCampaign("admin1", { title: "Bảo trì", content: "Tối nay", type: "MAINTENANCE", targetType: "ROLE", targetRole: "RECIPIENT" }),
      /Không có tài khoản nào/
    );
  });

  it("recalls a campaign from every inbox, records why and refreshes those inboxes", async () => {
    const result = await adminService.recallNotificationCampaign("admin1", "nc1", "Gửi nhầm nhóm");
    assert.deepEqual(result, { id: "nc1", removed: 2 });
    assert.deepEqual(calls, [
      ["recall", "nc1", "admin1", "Gửi nhầm nhóm"],
      ["audit", "NOTIFICATION_CAMPAIGN_RECALLED", { reason: "Gửi nhầm nhóm", removed: 2, readBeforeRecall: 3 }],
      ["realtime", ["u1", "u2"], { campaignId: "nc1", recalled: true }]
    ]);
  });

  it("refuses to recall twice, and says to reload when another admin just did", async () => {
    campaign = { ...campaign, recalledAt: new Date() };
    await assert.rejects(adminService.recallNotificationCampaign("admin1", "nc1", "Lý do"), (error: any) => error.statusCode === 400);
    campaign = { ...campaign, recalledAt: null };
    recalled = null;
    await assert.rejects(adminService.recallNotificationCampaign("admin1", "nc1", "Lý do"), (error: any) => error.statusCode === 409);
    assert.equal(calls.some((call) => call[0] === "realtime"), false);
  });

  it("answers 404 for a campaign that does not exist", async () => {
    campaign = null;
    await assert.rejects(adminService.recallNotificationCampaign("admin1", "nope", "Lý do"), (error: any) => error.statusCode === 404);
  });
});
