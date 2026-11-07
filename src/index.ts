import "dotenv/config";

import cors from "cors";
import express from "express";
import { createServer } from "node:http";

import { initializeSocket } from "@/socket";

const app = express();

const { ALLOWED_ORIGIN, PORT } = process.env;

if (!ALLOWED_ORIGIN) {
  throw new Error("ALLOWED_ORIGIN is not defined");
}

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  }),
);

app.get("/", (_, res) => {
  res.status(200).json({
    message: "Server is running",
  });
});

const server = createServer(app);

initializeSocket(server, ALLOWED_ORIGIN);

server.listen(Number(PORT), () => {
  console.log(`Server is running on port ${PORT}`);
});
