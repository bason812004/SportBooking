import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const persisted: any[] = [];
const emitted: any[] = [];
let failCreate = false;
mock.module("../../config/db.js", { namedExports: { prisma: {
  user: { findMany: async ({ where }: any) => {
    assert.deepEqual(where, { role: "ADMIN", status: "ACTIVE" });
    return [{ id: "admin1" }, { id: "admin2" }];
  } },
  notification: {
    create: async ({ data }: any) => {
      if (failCreate) throw new Error("database unavailable");
      const row = { id: `notice${persisted.length + 1}`, ...data, isRead: false };
      persisted.push(row);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      const matches = persisted.filter((row) => row.userId === where.userId && (!where.id || row.id === where.id) && (where.isRead === undefined || row.isRead === where.isRead));
      matches.forEach((row) => Object.assign(row, data));
      return { count: matches.length };
    },
    findUnique: async ({ where }: any) => persisted.find((row) => row.id === where.id)
  }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {
  toUser: (userId: string, event: string, payload: unknown) => emitted.push({ userId, event, payload })
} } });
const { notificationService } = await import("./notification.service.js");
beforeEach(() => { persisted.length = 0; emitted.length = 0; failCreate = false; });
const notice = { title: "Test notice", content: "Isolated test", type: "BLOG_UPDATE_REQUESTED", metadata: { blogId: "blog1" } };

test("admin notification persists and emits to every active administrator", async () => {
  await notificationService.notifyAdmins(notice);
  assert.deepEqual(persisted.map((row) => row.userId), ["admin1", "admin2"]);
  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted.map(({ userId, event }) => ({ userId, event })), [
    { userId: "admin1", event: "notification:new" }, { userId: "admin2", event: "notification:new" }
  ]);
  assert.deepEqual(emitted[0].payload.metadata, notice.metadata);
});

test("failed persistence does not emit a notification that cannot be loaded", async () => {
  failCreate = true;
  await assert.rejects(notificationService.create({ userId: "admin1", ...notice }));
  assert.equal(emitted.length, 0);
});

test("administrator can mark their notification read", async () => {
  const row = await notificationService.create({ userId: "admin1", ...notice });
  assert.equal((await notificationService.markRead("admin1", row.id))?.isRead, true);
});

test("mark read cannot change another recipient's notification", async () => {
  const row = await notificationService.create({ userId: "admin1", ...notice });
  await assert.rejects(notificationService.markRead("admin2", row.id), { statusCode: 404 });
  assert.equal(row.isRead, false);
});

test("mark all read only changes the current administrator's unread items", async () => {
  await notificationService.notifyAdmins(notice);
  assert.deepEqual(await notificationService.markAllRead("admin1"), { updated: 1 });
  assert.equal(persisted[0].isRead, true);
  assert.equal(persisted[1].isRead, false);
});
