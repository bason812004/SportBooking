import type { Server } from "socket.io";

let io: Server | null = null;

// Type-only import keeps the realtime module free of hard references to the
// weekly-schedule module so it can stay embeddable in any entry point. The
// actual invalidation function is injected at startup (see below).
type CacheInvalidator = (courtId?: string, weekStart?: string) => void;
let weeklyScheduleInvalidator: CacheInvalidator | null = null;

export function registerWeeklyScheduleCacheInvalidator(fn: CacheInvalidator) {
  weeklyScheduleInvalidator = fn;
}

export function registerRealtimeServer(server: Server) {
  io = server;
}

function emit(room: string, event: string, payload: unknown) {
  io?.to(room).emit(event, payload);
}

export const realtimeService = {
  toUser(userId: string, event: string, payload: unknown) {
    emit(`user:${userId}`, event, payload);
  },
  toPartner(partnerId: string, event: string, payload: unknown) {
    emit(`partner:${partnerId}`, event, payload);
  },
  toAdmin(event: string, payload: unknown) {
    emit("admin", event, payload);
  },
  toCourt(courtId: string, event: string, payload: unknown) {
    emit(`court:${courtId}`, event, payload);
    if (event === "court:availability-updated") {
      // Drop any cached weekly schedule for this court — every other client
      // that re-mounts the calendar will fetch fresh data on next request.
      weeklyScheduleInvalidator?.(courtId);
    }
  },
  toBooking(bookingId: string, event: string, payload: unknown) {
    emit(`booking:${bookingId}`, event, payload);
  },
  toTeamPost(postId: string, event: string, payload: unknown) {
    emit(`team-post:${postId}`, event, payload);
  },
  toPublic(event: string, payload: unknown) {
    io?.emit(event, payload);
  }
};
