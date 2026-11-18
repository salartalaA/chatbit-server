import type {
  ChatbitServer,
  ChatbitSocket,
  RoomAuthorizationResult,
  TypingUser,
} from "@/types/rooms";

const typingUsers = new Map<string, Map<string, TypingUser>>();

function broadcastTypingUsers(socket: ChatbitSocket, roomId: string) {
  const users = Array.from(typingUsers.get(roomId)?.values() ?? []);

  socket.to(roomId).emit("typing:update", { users });
}

export function registerRoomHandlers(io: ChatbitServer, socket: ChatbitSocket) {
  socket.on("room:join", async (roomId, password, callback) => {
    try {
      const baseURL = process.env.NEXT_SERVER_URL;

      if (!baseURL) {
        throw new Error("NEXT_SERVER_URL is not configured");
      }

      const response = await fetch(
        `${baseURL}/api/rooms/${encodeURIComponent(roomId)}/authorize`,
        {
          headers: {
            cookie: socket.handshake.headers.cookie ?? "",
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({
            password,
          }),
        },
      );

      const payload: unknown = await response.json();

      if (
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload) ||
        !("authorized" in payload) ||
        typeof payload.authorized !== "boolean" ||
        (payload.authorized === false &&
          (!("code" in payload) ||
            typeof payload.code !== "string" ||
            !("message" in payload) ||
            typeof payload.message !== "string"))
      ) {
        throw new Error("Invalid authorization response");
      }

      const result = payload as RoomAuthorizationResult;

      if (!result.authorized) {
        callback({
          success: false,
          message: result.message,
          code: result.code,
        });

        return;
      }

      if (!response.ok) {
        callback({
          success: false,
          message: "Authorization request failed",
          code: "AUTHORIZATION_FAILED",
        });

        return;
      }

      await socket.join(roomId);

      callback({
        success: true,
        message: "Joined successfully",
        roomId,
      });
    } catch (error) {
      console.error("Room authorization failed:", error);

      callback({
        success: false,
        message: "Unable to authorize room access",
        code: "AUTHORIZATION_FAILED",
      });
    }
  });

  socket.on("message:send", async (payload, callback) => {
    try {
      const baseURL = process.env.NEXT_SERVER_URL;

      const socketServerSecret = process.env.SOCKET_SERVER_SECRET;

      if (!baseURL) {
        throw new Error("NEXT_SERVER_URL is not configured");
      }

      if (!socketServerSecret) {
        throw new Error("SOCKET_SERVER_SECRET is not configured");
      }

      const { content, roomId } = payload;

      if (!socket.rooms.has(payload.roomId)) {
        callback({
          success: false,
          code: "NOT_IN_ROOM",
          message: "You are not a member of this room",
        });

        return;
      }

      if (!content.trim() || content.length > 5000) {
        callback({
          success: false,
          code: "INVALID_REQUEST",
          message: "Invalid message content",
        });

        return;
      }

      const response = await fetch(
        `${process.env.NEXT_SERVER_URL}/api/rooms/${roomId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-socket-server-secret": socketServerSecret,
          },
          body: JSON.stringify({
            content,
            userId: socket.data.user.id,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        callback({
          success: false,
          code: "MESSAGE_FAILED",
          message: result.error,
        });

        return;
      }

      const { message } = result;

      io.to(roomId).emit("message:new", message);

      callback({
        success: true,
      });
    } catch (error) {
      console.error("Failed to send message:", error);

      callback({
        success: false,
        message: "Unable to send message",
        code: "MESSAGE_FAILED",
      });
    }
  });

  socket.on("message:history", async (roomId, callback) => {
    try {
      const baseURL = process.env.NEXT_SERVER_URL;

      const socketServerSecret = process.env.SOCKET_SERVER_SECRET;

      if (!baseURL) {
        throw new Error("NEXT_SERVER_URL is not configured");
      }

      if (!socketServerSecret) {
        throw new Error("SOCKET_SERVER_SECRET is not configured");
      }

      if (!socket.rooms.has(roomId)) {
        callback({
          success: false,
          code: "NOT_IN_ROOM",
          message: "You are not a member of this room",
        });

        return;
      }

      const response = await fetch(
        `${process.env.NEXT_SERVER_URL}/api/rooms/${roomId}/messages`,
        {
          headers: {
            "x-socket-server-secret": socketServerSecret,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        callback({
          success: false,
          code: "INVALID_REQUEST",
          message: result.error,
        });

        return;
      }

      callback({
        success: true,
        messages: result.messages,
      });
    } catch (error) {
      console.error("Failed to receive previous messages:", error);

      callback({
        success: false,
        message: "Unable to receive previous messages",
        code: "HISTORY_FAILED",
      });
    }
  });

  socket.on("typing:start", (roomId) => {
    const { id: userId, name } = socket.data.user;

    if (!socket.rooms.has(roomId)) return;

    let roomUsers = typingUsers.get(roomId);

    if (!roomUsers) {
      roomUsers = new Map();
      typingUsers.set(roomId, roomUsers);
    }

    if (roomUsers.has(userId)) return;

    roomUsers.set(userId, { id: userId, name });

    broadcastTypingUsers(socket, roomId);
  });

  socket.on("typing:stop", (roomId) => {
    const { id: userId } = socket.data.user;

    if (!socket.rooms.has(roomId)) return;

    const roomUsers = typingUsers.get(roomId);

    if (!roomUsers?.delete(userId)) return;

    if (roomUsers.size === 0) {
      typingUsers.delete(roomId);
    }

    broadcastTypingUsers(socket, roomId);
  });
}
