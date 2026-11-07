import type { ChatbitSocket, RoomAuthorizationResult } from "@/types/rooms";

export function registerRoomHandlers(socket: ChatbitSocket) {
  socket.on("room:join", async (roomId, callback) => {
    try {
      const baseURL = process.env.NEXT_SERVER_URL;

      if (!baseURL) {
        throw new Error("NEXT_SERVER_URL is not configured");
      }

      const response = await fetch(`${baseURL}/api/rooms/${roomId}/authorize`, {
        headers: {
          cookie: socket.handshake.headers.cookie ?? "",
        },
      });

      const result = (await response.json()) as RoomAuthorizationResult;

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
}
