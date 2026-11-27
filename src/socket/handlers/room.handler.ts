
import type {
  ChatbitServer,
  ChatbitSocket,
  MessageDTO,
  RoomAuthorizationResult,
  RoomMember,
  TypingUser,
} from "@/types/rooms";

const typingUsers = new Map<string, Map<string, TypingUser>>();

const roomMembers = new Map<string, Map<string, RoomMember>>();

function broadcastTypingUsers(socket: ChatbitSocket, roomId: string) {
  const users = Array.from(typingUsers.get(roomId)?.values() ?? []);

  socket.to(roomId).emit("typing:update", { users });
}

function isValidVoiceMessage(message: unknown): message is MessageDTO {
  if (
    typeof message !== "object" ||
    message === null ||
    Array.isArray(message)
  ) {
    return false;
  }

  const candidate = message as Partial<MessageDTO>;

  return (
    candidate.type === "VOICE" &&
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.roomId === "string" &&
    candidate.roomId.length > 0 &&
    typeof candidate.audioKey === "string" &&
    candidate.audioKey.length > 0 &&
    typeof candidate.duration === "number" &&
    Number.isFinite(candidate.duration) &&
    candidate.duration > 0 &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.sender === "object" &&
    candidate.sender !== null &&
    typeof candidate.sender.id === "string" &&
    typeof candidate.sender.name === "string" &&
    (typeof candidate.sender.image === "string" ||
      candidate.sender.image === null)
  );
}

export function registerRoomHandlers(io: ChatbitServer, socket: ChatbitSocket) {
  socket.on("room:join", async (roomId, password, callback) => {
    try {
      const baseURL = process.env.NEXT_SERVER_URL;
      const socketServerSecret = process.env.SOCKET_SERVER_SECRET;

      if (!baseURL) {
        throw new Error("NEXT_SERVER_URL is not configured");
      }

      if (!socketServerSecret) {
        throw new Error("SOCKET_SERVER_SECRET is not configured");
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

      let messages: MessageDTO[];

      try {
        const historyResponse = await fetch(
          `${baseURL}/api/rooms/${encodeURIComponent(roomId)}/messages`,
          {
            headers: {
              "x-socket-server-secret": socketServerSecret,
            },
          },
        );

        const historyResult = await historyResponse.json();

        if (!historyResponse.ok) {
          callback({
            success: false,
            code: "HISTORY_FAILED",
            message: historyResult.error,
          });

          return;
        }

        messages = historyResult.messages;
      } catch (error) {
        console.error("Failed to receive previous messages:", error);

        callback({
          success: false,
          message: "Unable to receive previous messages",
          code: "HISTORY_FAILED",
        });

        return;
      }

      const user = socket.data.user;

      const member: RoomMember = {
        id: user.id,
        name: user.name,
        image: user.image,
      };

      await socket.join(roomId);

      if (!roomMembers.has(roomId)) {
        roomMembers.set(roomId, new Map());
      }

      const membersMap = roomMembers.get(roomId)!;

      const isNewMember = !membersMap.has(user.id);

      membersMap.set(user.id, member);

      socket.data.roomId = roomId;

      const members = Array.from(membersMap.values());

      callback({
        success: true,
        message: "Joined successfully",
        roomId,
        members,
        messages,
      });

      if (isNewMember) {
        socket.to(roomId).emit("member:joined", member);
      }
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
        `${baseURL}/api/rooms/${encodeURIComponent(roomId)}/messages`,
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

  socket.on("voice:created", (message) => {
    if (!isValidVoiceMessage(message)) {
      console.error("Invalid voice message payload");
      return;
    }

    const { roomId } = message;
    const userId = socket.data.user.id;

    if (!socket.rooms.has(roomId) || socket.data.roomId !== roomId) {
      console.warn("Voice message rejected: sender is not in the room");
      return;
    }

    if (message.sender.id !== userId) {
      console.warn("Voice message rejected: sender ID mismatch");
      return;
    }

    io.to(roomId).emit("message:new", message);
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

  socket.on("room:deleted", () => {
    const roomId = socket.data.roomId;

    if (!roomId) {
      return;
    }

    io.to(roomId).emit("room:deleted");
    io.in(roomId).disconnectSockets(true);

    roomMembers.delete(roomId);
    typingUsers.delete(roomId);
  });

  socket.on("user:name-updated", (data, callback) => {
    const name = data.name.trim();

    if (name.length < 2 || name.length > 30) {
      return callback({
        success: false,
        message: "Invalid name.",
      });
    }

    const roomId = socket.data.roomId;

    if (!roomId) {
      return callback({
        success: false,
        message: "You are not in a room.",
      });
    }

    io.to(roomId).emit("user:name-updated", {
      userId: socket.data.user.id,
      name,
    });

    callback({ success: true });
  });

  socket.on("room:expired", (roomId: string) => {
    if (socket.data.roomId !== roomId) {
      return;
    }

    io.to(roomId).emit("room:expired");
    io.in(roomId).disconnectSockets(true);

    roomMembers.delete(roomId);
    typingUsers.delete(roomId);
  });

  socket.on("disconnect", () => {
    const userId = socket.data.user.id;
    const roomId = socket.data.roomId;

    if (!roomId) {
      return;
    }

    const membersMap = roomMembers.get(roomId);

    if (!membersMap) {
      return;
    }

    const isMember = membersMap.delete(userId);

    if (!isMember) {
      return;
    }

    if (membersMap.size === 0) {
      roomMembers.delete(roomId);
    }

    socket.to(roomId).emit("member:left", {
      userId,
    });
  });
}
