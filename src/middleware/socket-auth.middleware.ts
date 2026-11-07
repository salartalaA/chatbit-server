import type { Socket } from "socket.io";

interface AuthenticatedSession {
  session: {
    userId: string;
  };
  user: {
    id: string;
  };
}

function isAuthenticatedSession(value: unknown): value is AuthenticatedSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("session" in value) || !("user" in value)) {
    return false;
  }

  const { session, user } = value;

  return (
    typeof session === "object" &&
    session !== null &&
    "userId" in session &&
    typeof session.userId === "string" &&
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    typeof user.id === "string" &&
    session.userId === user.id
  );
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (error?: Error) => void,
) {
  try {
    const cookie = socket.handshake.headers.cookie;
    const authUrl = process.env.BETTER_AUTH_URL;

    if (!cookie || !authUrl) {
      return next(new Error("UNAUTHORIZED"));
    }

    const response = await fetch(
      `${authUrl}/api/auth/get-session?disableCookieCache=true`,
      {
        headers: { cookie },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return next(new Error("AUTH_SERVICE_ERROR"));
    }

    const data: unknown = await response.json();

    if (!isAuthenticatedSession(data)) {
      return next(new Error("UNAUTHORIZED"));
    }

    socket.data.user = {
      id: data.user.id,
    };

    next();
  } catch {
    next(new Error("AUTH_SERVICE_UNAVAILABLE"));
  }
}
