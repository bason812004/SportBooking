import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(accessToken: string) {
  if (socket?.connected) return socket;
  socket = io((import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api").replace(/\/api\/?$/, ""), {
    auth: { token: accessToken },
    autoConnect: true,
    transports: ["websocket"]
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
