import type { Server } from "socket.io";

export type RealtimeServer = Server;

export type RealtimeUser = {
  id: string;
  role: "USER" | "PARTNER" | "ADMIN";
};
