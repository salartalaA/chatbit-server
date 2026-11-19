import type { DefaultEventsMap, Server, Socket } from "socket.io";

export interface SocketData {
  user: {
    id: string;
    name: string;
    image: string;
  };
  roomId?: string;
}

export interface RoomMember {
  id: string;
  name: string;
  image?: string;
}

export interface TypingUser {
  id: string;
  name: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

export interface MessageDTO {
  id: string;
  content: string;
  roomId: string;
  sender: {
    id: string;
    name: string;
    image: string | null;
  };
  createdAt: string;
}

export interface ClientToServerEvents {
  "room:join": (
    roomId: string,
    password: string,
    callback: (response: JoinRoomResponse) => void,
  ) => void;

  "message:send": (
    payload: SendMessagePayload,
    callback: (response: SendMessageResponse) => void,
  ) => void;

  "typing:start": (roomId: string) => void;
  "typing:stop": (roomId: string) => void;

  "room:deleted": () => void;

  "user:name-updated": (
    data: { name: string },
    callback: (response: { success: boolean; message?: string }) => void,
  ) => void;

  "room:expired": (roomId: string) => void;
}

export interface ServerToClientEvents {
  "connection:rejected": (response: { code: "ALREADY_CONNECTED" }) => void;

  "message:new": (message: MessageDTO) => void;

  "typing:update": (payload: { users: TypingUser[] }) => void;

  "member:joined": (member: RoomMember) => void;

  "member:left": (payload: { userId: string }) => void;

  "room:deleted": () => void;

  "user:name-updated": (data: { userId: string; name: string }) => void;

  "room:expired": () => void;
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
        | "ROOM_SWITCH_FAILED"
        | "HISTORY_FAILED";
    }
  | {
      success: true;
      message: string;
      roomId: string;
      members: RoomMember[];
      messages: MessageDTO[];
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

export type SendMessageResponse =
  | {
      success: true;
    }
  | {
      success: false;
      code: "INVALID_REQUEST" | "NOT_IN_ROOM" | "MESSAGE_FAILED";
      message: string;
    };

export type ChatbitSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

export type ChatbitServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;
