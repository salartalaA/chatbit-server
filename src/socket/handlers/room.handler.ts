import type {
  ChatbitServer,
  ChatbitSocket,
  RoomAuthorizationResult,
} from "@/types/rooms";

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
}
