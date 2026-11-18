import { DefaultEventsMap, Server } from "socket.io";
import type { Server as HTTPServer } from "node:http";

import { activeConnections } from "@/lib/active-connections";
import { socketAuthMiddleware } from "@/middleware/socket-auth.middleware";
import { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/types/rooms";
import { registerRoomHandlers } from "@/socket/handlers/room.handler";

export function initializeSocket(server: HTTPServer, allowedOrigin: string) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    DefaultEventsMap,
    SocketData
  >(server, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const userId = socket.data.user.id;

    if (activeConnections.has(userId)) {
      socket.emit("connection:rejected", {
        code: "ALREADY_CONNECTED",
      });

      socket.disconnect(true);
      return;
    }

    activeConnections.set(userId, socket.id);

    console.log(`User connected: ${userId}`);

    registerRoomHandlers(io, socket);

    socket.on("disconnect", () => {
      if (activeConnections.get(userId) === socket.id) {
        activeConnections.delete(userId);
      }

      console.log(`User disconnected: ${userId}`);
    });
  });

  return io;
}
