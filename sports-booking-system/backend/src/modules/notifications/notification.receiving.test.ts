import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import express from "express";

// Exercise the real HTTP routes, service, repository and Socket.IO gateway.
// Only authentication credentials and database storage are replaced; no live notices are sent.
let rows: any[] = [];
let sequence = 0;
const matching = (where: any) => rows.filter((row) => row.userId === where.userId && (!where.id || row.id === where.id) && (where.isRead === undefined || row.isRead === where.isRead));
mock.module("../../config/db.js", { namedExports: { prisma: {
  $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  user: { findMany: async () => [{ id: "admin1" }] },
  notification: {
    create: async ({ data }: any) => {
      const row = { ...data, id: `notice${++sequence}`, isRead: false, createdAt: new Date(sequence * 1000).toISOString() };
      rows.push(row);
      return row;
    },
    findMany: async ({ where, skip, take }: any) => matching(where).reverse().slice(skip, skip + take),
    count: async ({ where }: any) => matching(where).length,
    updateMany: async ({ where, data }: any) => {
      const found = matching(where);
      found.forEach((row) => Object.assign(row, data));
      return { count: found.length };
    },
    findUnique: async ({ where }: any) => rows.find((row) => row.id === where.id)
  }
} } });
mock.module("../../config/env.js", { namedExports: { env: { FRONTEND_URL: "http://localhost:5173" } } });
mock.module("../auth/auth.security.js", { namedExports: { verifyAccessToken: (token: string) => {
  if (token !== "test-admin") throw new Error("invalid token");
  return { sub: "admin1", role: "ADMIN" };
} } });
mock.module("../weekly-schedule/weeklySchedule.service.js", { namedExports: { invalidateWeeklyScheduleCache: () => undefined } });
mock.module("../../middlewares/auth.middleware.js", { namedExports: { authMiddleware: (req: any, res: any, next: any) => {
  if (req.headers.authorization !== "Bearer test-admin") return res.status(401).json({ success: false });
  req.user = { id: "admin1", role: "ADMIN" };
  next();
} } });

const { notificationRoutes } = await import("./notification.routes.js");
const { notificationService } = await import("./notification.service.js");
const { initRealtime } = await import("../realtime/realtime.server.js");
const app = express();
app.use("/api/users", express.json(), notificationRoutes);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode ?? 500).json({ message: error.message }));
const server = createServer(app);
const io = initRealtime(server);
let base = "";
const sockets: WebSocket[] = [];
before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  base = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => { rows = []; sequence = 0; });
after(async () => {
  sockets.forEach((socket) => socket.close());
  await new Promise<void>((resolve) => io.close(() => resolve()));
});
const request = (path = "", method = "GET") => fetch(`${base}/api/users/me/notifications${path}`, { method, headers: { authorization: "Bearer test-admin" } });
const input = { title: "Review needed", content: "Isolated test", type: "BLOG_UPDATE_REQUESTED" };

async function connectAdmin() {
  const socket = new WebSocket(`${base.replace("http:", "ws:")}/socket.io/?EIO=4&transport=websocket`);
  sockets.push(socket);
  let resolveNotice!: (notice: any) => void;
  const notification = new Promise<any>((resolve) => { resolveNotice = resolve; });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("error", reject);
    socket.addEventListener("message", (event) => {
      const packet = String(event.data);
      if (packet.startsWith("0")) socket.send('40{"token":"test-admin"}');
      else if (packet === "2") socket.send("3");
      else if (packet.startsWith("40")) resolve();
      else if (packet.startsWith("42")) {
        const [name, payload] = JSON.parse(packet.slice(2));
        if (name === "notification:new") resolveNotice(payload);
      }
    });
  });
  return { socket, notification };
}

test("ADMIN receives notification:new over a real socket and loads that item through HTTP", { timeout: 5000 }, async () => {
  const peer = await connectAdmin();
  await notificationService.notifyAdmins(input);
  const received = await peer.notification;
  const response = await request();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.items[0].id, received.id);
  assert.equal(body.data.items[0].isRead, false);
  peer.socket.close();
});

test("HTTP read actions update own notices and reject other users' notices", { timeout: 5000 }, async () => {
  const own = await notificationService.create({ ...input, userId: "admin1" });
  const other = await notificationService.create({ ...input, userId: "user1" });
  assert.equal((await request(`/${other.id}/read`, "PUT")).status, 404);
  assert.equal((await request(`/${own.id}/read`, "PUT")).status, 200);
  assert.equal(other.isRead, false);
  assert.equal(own.isRead, true);
  await notificationService.create({ ...input, userId: "admin1" });
  assert.equal((await (await request("/read-all", "PUT")).json()).data.updated, 1);
  assert.equal((await (await request()).json()).data.items.length, 2);
});

test("offline notices remain available through HTTP after ADMIN reconnects", { timeout: 5000 }, async () => {
  await notificationService.notifyAdmins(input);
  const peer = await connectAdmin();
  assert.equal((await (await request()).json()).data.items.length, 1);
  peer.socket.close();
});

test("unread total includes older unread items outside the default first page", { timeout: 5000 }, async () => {
  const old = await notificationService.create({ ...input, userId: "admin1" });
  for (let i = 0; i < 10; i++) {
    const row = await notificationService.create({ ...input, userId: "admin1" });
    await notificationService.markRead("admin1", row.id);
  }
  const first = (await (await request()).json()).data;
  assert.equal(first.meta.total, 11);
  assert.equal(first.unreadCount, 1);
  assert.equal(first.items.filter((row: any) => !row.isRead).length, 0);
  const second = (await (await request("?page=2")).json()).data;
  assert.equal(second.items[0].id, old.id);
  assert.equal(second.items[0].isRead, false);
});

test("unauthenticated HTTP access is denied", { timeout: 5000 }, async () => {
  assert.equal((await fetch(`${base}/api/users/me/notifications`)).status, 401);
});
