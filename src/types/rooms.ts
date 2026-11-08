import type { DefaultEventsMap, Socket } from "socket.io";

export interface SocketData {
  user: {
    id: string;
  };
}

export interface ClientToServerEvents {
  "room:join": (
    roomId: string,
    password: string,
    callback: (response: JoinRoomResponse) => void,
  ) => void;
}

export type JoinRoomResponse =
  | {
      success: false;
      message: string;
      code:
        | "ROOM_NOT_FOUND"
        | "ACCESS_DENIED"
        | "INVALID_REQUEST"
        | "UNAUTHORIZED"
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
      code:
        | "ACCESS_DENIED"
        | "ROOM_NOT_FOUND"
        | "INVALID_REQUEST"
        | "UNAUTHORIZED";
      message: string;
    };

export type ChatbitSocket = Socket<
  ClientToServerEvents,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
