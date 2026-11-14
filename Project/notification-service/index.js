const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createClient } = require("redis");
require("dotenv").config();

const { JwtVerifier } = require("./src/jwt-verifier");
const { createEventDispatcher } = require("./src/event-dispatcher");
const { roomForClaims, canJoinRoom } = require("./src/room-access");

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
const authServiceUrl = (process.env.AUTH_SERVICE_URL || "http://localhost:8081").replace(/\/+$/, "");

async function authorizeStaffSocket(token, restaurantId) {
  let response;
  try {
    response = await fetch(`${authServiceUrl}/auth/access/authorize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        featureKey: "KITCHEN_DISPLAY",
        permission: "ORDER_READ_ACTIVE",
        restaurantId,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    throw new Error("Authorization service is unavailable");
  }
  let result = {};
  try {
    result = await response.json();
  } catch (error) {
    if (response.status !== 401 && response.status !== 403) {
      throw new Error("Authorization service returned an invalid response");
    }
  }
  if (!response.ok || !result.allowed || !result.context) {
    const error = new Error(result.message || "Staff access denied");
    error.code = result.code || (response.status === 401 ? "TOKEN_INVALID" : "ACCESS_DENIED");
    throw error;
  }
  return result.context;
}

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
    socket.leaveAll();
    socket.claims = null;
    try {
      const claims = await verifier.verify(token);

      if (claims.type === "STAFF") {
        const context = await authorizeStaffSocket(token, claims.restaurantId);
        claims.roles = [context.role];
        claims.privileges = context.permissions;
        claims.restaurantId = context.restaurantId;
        socket.claims = claims;
        const kitchenRoom = `kitchen:${claims.restaurantId}`;
        socket.join(kitchenRoom);
        socket.emit("authenticated", { role: "STAFF", room: kitchenRoom });
        console.log(`[Notification Service] Staff ${socket.id} joined ${kitchenRoom}`);
      } else if (claims.type === "CUSTOMER" && claims.tableSessionId) {
        socket.claims = claims;
        const tableRoom = `table:${claims.tableSessionId}`;
        socket.join(tableRoom);
        socket.emit("authenticated", { role: "CUSTOMER", room: tableRoom });
        console.log(`[Notification Service] Customer ${socket.id} joined ${tableRoom}`);
      } else {
        throw new Error("A supported staff or table-session token is required");
      }
    } catch (err) {
      socket.emit("auth_error", {
        code: err.code || "AUTHENTICATION_FAILED",
        message: err.message === "Authorization service is unavailable"
          || err.message === "Authorization service returned an invalid response"
          ? "Authorization service is temporarily unavailable"
          : err.message,
      });
    }
  });

  // Explicit joins are restricted to the identity-scoped room for this token.
  socket.on("join_room", (room) => {
    const claims = socket.claims;
    if (!claims || !canJoinRoom(claims, room)) {
      socket.emit("room_error", { message: "Room is outside the authenticated scope" });
      return;
    }
    socket.join(room);
    socket.emit("joined_room", { room });
  });

  socket.on("leave_room", (room) => {
    const claims = socket.claims;
    const allowedRoom = roomForClaims(claims);
    if (room && room === allowedRoom) socket.leave(room);
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
