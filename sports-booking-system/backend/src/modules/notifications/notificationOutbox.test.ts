import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let fail = false;
let pending = true;
const retries: bigint[] = [];
const emitted: unknown[] = [];
mock.module("./notificationOutbox.repository.js", { namedExports: { notificationOutboxRepository: {
  due: async () => pending ? [{ id: 1n }] : [],
  deliver: async () => {
    if (fail) throw new Error("Transient database failure");
    pending = false;
    return [{ id: "notice1", userId: "admin1" }, { id: "notice2", userId: "admin2" }];
  },
  retry: async (id: bigint) => { retries.push(id); }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {
  toUser: (userId: string, event: string, data: unknown) => {
    assert.equal(pending, false, "delivery must commit before realtime emission");
    emitted.push({ userId, event, data });
  }
} } });
const { deliverPendingAdminNotifications } = await import("./notificationOutbox.service.js");
beforeEach(() => { fail = false; pending = true; retries.length = 0; emitted.length = 0; });

test("committed delivery emits to all recipients and is not repeated on the next sweep", async () => {
  await deliverPendingAdminNotifications();
  await deliverPendingAdminNotifications();
  assert.equal(emitted.length, 2);
  assert.equal(retries.length, 0);
});

test("failed delivery is scheduled for retry without emitting; later delivery succeeds", async () => {
  fail = true;
  await deliverPendingAdminNotifications();
  assert.deepEqual(retries, [1n]);
  assert.equal(emitted.length, 0);
  fail = false;
  await deliverPendingAdminNotifications();
  assert.equal(emitted.length, 2);
});
