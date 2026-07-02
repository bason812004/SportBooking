import type { Server } from "socket.io";

let io: Server | null = null;

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
  },
  toBooking(bookingId: string, event: string, payload: unknown) {
    emit(`booking:${bookingId}`, event, payload);
  },
  toPublic(event: string, payload: unknown) {
    io?.emit(event, payload);
  }
};
