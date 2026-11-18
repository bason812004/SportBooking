import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

let report: any;
let stillPending: boolean;
let latest: Array<{ authorRole: string; createdAt: Date }>;
let calls: unknown[][];
mock.module("./report.repository.js", { namedExports: { reportRepository: {
  thread: async () => report,
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  lockPending: async (id: string, tx: unknown) => {
    calls.push(["lock", id, tx]);
    return stillPending;
  },
  latestMessages: async () => latest,
  createMessage: async (data: any, tx: unknown) => {
    calls.push(["message", data.reportId, data.authorId, data.content, tx]);
    return { id: "rm0009", content: data.content, createdAt: new Date("2026-11-05T03:00:00Z"), author: { fullName: "Khách B" } };
  }
} } });
mock.module("../courts/court.repository.js", { namedExports: { courtRepository: { findPublicById: async () => ({ id: "c1" }) } } });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  notifyAdmins: async (notice: any) => { calls.push(["notify-admins", notice.type, notice.content, notice.metadata]); }
} } });
const { reportService } = await import("./report.service.js");

const at = (iso: string) => new Date(iso);

beforeEach(() => {
  report = {
    id: "rp0001",
    userId: "u1",
    status: "PENDING",
    reason: "Giá hiển thị chưa đúng",
    description: null,
    createdAt: at("2026-11-01T00:00:00Z"),
    resolvedAt: null,
    adminNote: null,
    user: { id: "u1", fullName: "Khách B" },
    court: { id: "c1", name: "Sân A" },
    resolver: null,
    messages: [{ id: "rm1", kind: "MESSAGE", authorRole: "ADMIN", content: "Khung giờ nào?", measures: null, createdAt: at("2026-11-02T00:00:00Z"), author: { fullName: "Admin A" } }]
  };
  stillPending = true;
  latest = [];
  calls = [];
});

describe("the reporter's conversation", () => {
  it("is shown only to the report's author, without the admin's name", async () => {
    const thread = await reportService.thread("u1", "rp0001");
    assert.equal(thread.canReply, true);
    assert.equal(thread.repliesLeft, 3);
    assert.deepEqual(thread.entries.map((entry) => entry.authorName), ["Khách B", null]);
    await assert.rejects(reportService.thread("u2", "rp0001"), (error: any) => error.statusCode === 404);
  });

  it("is read only once the report is closed", async () => {
    report = { ...report, status: "RESOLVED", resolvedAt: at("2026-11-03T00:00:00Z") };
    const thread = await reportService.thread("u1", "rp0001");
    assert.deepEqual([thread.canReply, thread.repliesLeft], [false, 0]);
    await assert.rejects(reportService.reply("u1", "rp0001", "Vẫn chưa sửa"), (error: any) => error.code === "REPORT_CLOSED");
    assert.deepEqual(calls, []);
  });
});

describe("the reporter's replies", () => {
  it("are saved under the report's lock and sent to the admins", async () => {
    const entry = await reportService.reply("u1", "rp0001", "Khung 18h tối thứ Bảy.");
    assert.deepEqual(calls, [
      ["lock", "rp0001", "tx"],
      ["message", "rp0001", "u1", "Khung 18h tối thứ Bảy.", "tx"],
      ["notify-admins", "REPORT_REPLIED", 'Khách B về sân "Sân A": Khung 18h tối thứ Bảy.', { reportId: "rp0001", courtId: "c1" }]
    ]);
    assert.deepEqual([entry.id, entry.authorRole], ["rm0009", "USER"]);
  });

  it("stop after three in a row until an admin answers", async () => {
    latest = [0, 1, 2].map((i) => ({ authorRole: "USER", createdAt: at(`2026-11-0${3 + i}T00:00:00Z`) }));
    await assert.rejects(reportService.reply("u1", "rp0001", "Còn nữa"), (error: any) => error.code === "REPORT_REPLY_LIMIT");
    latest = [...latest, { authorRole: "ADMIN", createdAt: at("2026-11-02T00:00:00Z") }].slice(1);
    await reportService.reply("u1", "rp0001", "Còn nữa");
    assert.equal(calls.filter((call) => call[0] === "message").length, 1);
  });

  it("are refused when the report closed meanwhile, and for someone else's report", async () => {
    stillPending = false;
    await assert.rejects(reportService.reply("u1", "rp0001", "Còn nữa"), (error: any) => error.code === "REPORT_CLOSED");
    await assert.rejects(reportService.reply("u2", "rp0001", "Còn nữa"), (error: any) => error.statusCode === 404);
    assert.equal(calls.some((call) => call[0] === "message"), false);
  });
});
