import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../../config/env.js";
import { prisma } from "../../config/db.js";
import { verifyAccessToken } from "../auth/auth.security.js";
import { registerRealtimeServer } from "./realtime.service.js";

export function initRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.auth?.accessToken;
    if (!token || typeof token !== "string") return next(new Error("UNAUTHORIZED"));

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, role: payload.role };
      return next();
    } catch {
      return next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as { id: string; role: "USER" | "PARTNER" | "ADMIN" };
    socket.join(`user:${user.id}`);
    if (user.role === "ADMIN") socket.join("admin");

    if (user.role === "PARTNER") {
      const partner = await prisma.partnerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (partner) socket.join(`partner:${partner.id}`);
    }

    socket.on("court:subscribe", (courtId: string) => {
      if (courtId) socket.join(`court:${courtId}`);
    });
    socket.on("court:unsubscribe", (courtId: string) => {
      if (courtId) socket.leave(`court:${courtId}`);
    });
    socket.on("booking:subscribe", (bookingId: string) => {
      if (bookingId) socket.join(`booking:${bookingId}`);
    });
    socket.on("booking:unsubscribe", (bookingId: string) => {
      if (bookingId) socket.leave(`booking:${bookingId}`);
    });
    socket.on("team-post:subscribe", async (postId: string) => {
      if (!postId) return;
      try {
        const [member] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
          select exists (
            select 1
            from team_recruitment_posts p
            left join team_post_members m on m.post_id = p.id and m.user_id = ${user.id}
            where p.id = ${postId}
              and (p.user_id = ${user.id} or m.id is not null)
          ) as "exists"
        `;
        if (member?.exists) socket.join(`team-post:${postId}`);
      } catch {
        socket.emit("team-post:subscribe-error", { postId });
      }
    });
    socket.on("team-post:unsubscribe", (postId: string) => {
      if (postId) socket.leave(`team-post:${postId}`);
    });
  });

  registerRealtimeServer(io);
  return io;
}
