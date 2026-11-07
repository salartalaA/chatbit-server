import type { DefaultEventsMap, Socket } from "socket.io";

export interface SocketData {
  user: {
    id: string;
  };
}

export interface ClientToServerEvents {
  "room:join": (
    roomId: string,
    callback: (response: JoinRoomResponse) => void,
  ) => void;
}

export type JoinRoomResponse =
  | {
      success: false;
      message: string;
      code:
        | "ROOM_NOT_FOUND"
        | "FORBIDDEN"
        | "AUTHORIZATION_FAILED"
        | "ROOM_SWITCH_FAILED";
    }
  | {
      success: true;
      message: string;
      roomId: string;
    };

export type RoomAuthorizationResult =
  | {
      authorized: true;
    }
  | {
      authorized: false;
      code: "ROOM_NOT_FOUND" | "FORBIDDEN";
      message: string;
    };

export type ChatbitSocket = Socket<
  ClientToServerEvents,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
