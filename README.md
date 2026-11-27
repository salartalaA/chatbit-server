# Chatbit Server

Chatbit Server is the dedicated real-time communication service for the Chatbit application, built with Express.js and Socket.IO.

Its primary responsibility is to manage concurrent client connections, handle chat room membership, and broadcast real-time events between connected users.

The server operates independently alongside the main Chatbit application. It handles real-time communication, while the main Next.js application is responsible for database operations and file storage.

## Related Project

[Main Chatbit Repository](https://github.com/salartalaA/chatbit)

## Features

- **Connection Management** — Handle client connections and disconnections using Socket.IO.
- **Connection Authentication** — Validate user sessions through the main application's authentication backend.
- **Duplicate Connection Prevention** — Prevent multiple active connections for the same user.
- **Room Management** — Handle user membership and room switching.
- **Access Control** — Verify authorization for private rooms through the main application's API.
- **Real-Time Messaging** — Receive new messages and broadcast them to room members.
- **Voice Message Events** — Broadcast newly uploaded voice messages after successful HTTP uploads.
- **Typing Indicator** — Track typing activity and broadcast updates to other room members.
- **Online Members** — Maintain in-memory information about connected room members.
- **Membership Events** — Notify users when members join or leave a room.
- **Room Expiration** — Handle room expiration events and notify connected clients.
- **Room Deletion** — Notify room members and disconnect users when a room is deleted.
- **User Name Updates** — Broadcast user name changes to other room members.

## Technologies

**Backend**
- Node.js
- Express.js
- TypeScript

**Real-Time Communication**
- Socket.IO

**Package Manager**
- pnpm

## Architecture

Chatbit Server is an independent Express.js service responsible for handling real-time communication within the Chatbit application.

Socket.IO manages client connections, room membership, and event broadcasting.

Online members and typing users are maintained in memory using JavaScript Map data structures, allowing the server to track the state of each room independently.

For authentication, room authorization, and message persistence, the server communicates with the main Chatbit backend through HTTP requests. The main Next.js application is responsible for database operations, while the Express server handles real-time event broadcasting.

Voice message files are uploaded directly to the main application's backend. After a successful upload, the Socket.IO server broadcasts the corresponding message event to other room members.

## Getting Started

### Prerequisites

- Node.js
- pnpm
- The main Chatbit application

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd chatbit-server
```

Install dependencies:

```bash
pnpm install
```

### Environment Variables

Create a `.env` file and configure the required environment variables.

These include:

- Express server port
- Main application backend URL (`NEXT_SERVER_URL`)
- Internal server authentication secret (`SOCKET_SERVER_SECRET`)

### Run the Development Server

```bash
pnpm dev
```

The server must run alongside the main Chatbit application to provide real-time communication functionality.

## Technical Goals

Chatbit Server provides practical experience with:

- Building an independent backend service using Express.js and TypeScript
- Implementing real-time communication with Socket.IO
- Designing Client-to-Server and Server-to-Client event contracts
- Managing chat rooms and user membership
- Maintaining real-time user state in memory
- Implementing typing indicators
- Validating incoming socket events
- Integrating independent services through HTTP communication
- Handling authentication and access authorization
- Managing client connection and room lifecycles