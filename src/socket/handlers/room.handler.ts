import type { ChatbitSocket, RoomAuthorizationResult } from "@/types/rooms";

export function registerRoomHandlers(socket: ChatbitSocket) {
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
}
