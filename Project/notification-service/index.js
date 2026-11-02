const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createClient } = require("redis");
require("dotenv").config();

const { JwtVerifier } = require("./src/jwt-verifier");
const { createEventDispatcher } = require("./src/event-dispatcher");

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  path: "/ws/socket.io",
});

const verifier = new JwtVerifier();
const dispatcher = createEventDispatcher(io);

// Health Check Endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    service: "notification-service",
    status: "UP",
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Notification & Real-Time Microservice is operational",
    version: "2.0.0",
  });
});

// Socket connection and room scoping
io.on("connection", (socket) => {
  console.log(`[Notification Service] Client connected: ${socket.id}`);

  // Authenticate socket and auto-join scoped rooms
  socket.on("authenticate", async (token) => {
    try {
      const claims = await verifier.verify(token);
      socket.claims = claims;

      if (claims.type === "STAFF" || claims.roles?.includes("SUPER_ADMIN")) {
        const kitchenRoom = `kitchen:${claims.restaurantId}`;
        socket.join(kitchenRoom);
        socket.emit("authenticated", { role: "STAFF", room: kitchenRoom });
        console.log(`[Notification Service] Staff ${socket.id} joined ${kitchenRoom}`);
      } else if (claims.type === "CUSTOMER" && claims.tableSessionId) {
        const tableRoom = `table:${claims.tableSessionId}`;
        socket.join(tableRoom);
        socket.emit("authenticated", { role: "CUSTOMER", room: tableRoom });
        console.log(`[Notification Service] Customer ${socket.id} joined ${tableRoom}`);
      }
    } catch (err) {
      socket.emit("auth_error", { message: err.message });
    }
  });

  // Explicit room join
  socket.on("join_room", (room) => {
    socket.join(room);
    socket.emit("joined_room", { room });
  });

  socket.on("leave_room", (room) => {
    socket.leave(room);
  });

  socket.on("disconnect", () => {
    console.log(`[Notification Service] Client disconnected: ${socket.id}`);
  });
});

// Redis Subscriber Setup
async function initRedis() {
  const redisSubscriber = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT || 6379),
    },
  });

  redisSubscriber.on("error", (err) => {
    console.error("[Notification Service] Redis Subscriber Error:", err.message);
  });

  try {
    await redisSubscriber.connect();
    console.log("[Notification Service] Connected to Redis. Subscribing to order_events...");
    await redisSubscriber.subscribe("order_events", (message) => {
      dispatcher.dispatch(message);
    });
  } catch (err) {
    console.warn("[Notification Service] Redis subscription failed (running in fallback mode):", err.message);
  }
}

server.listen(PORT, async () => {
  console.log(`[Notification Service] Running on port ${PORT}`);
  await initRedis();
});

module.exports = { app, server, io, dispatcher };
