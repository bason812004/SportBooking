import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(accessToken?: string | null) {
  const token = accessToken ?? null;
  if (socket && socketToken === token && socket.connected) return socket;
  if (socket && socketToken === token) return socket;

  socket?.disconnect();
  socketToken = token;
  socket = io((import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api").replace(/\/api\/?$/, ""), {
    auth: token ? { token } : {},
    autoConnect: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

