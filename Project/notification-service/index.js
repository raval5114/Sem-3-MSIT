const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/ws/socket.io'
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'notification-service',
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// Root / API Status
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Notification & Real-Time Microservice is operational',
    version: '1.0.0'
  });
});

io.on('connection', (socket) => {
  console.log(`[Notification Service] Client connected: ${socket.id}`);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`[Notification Service] Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Notification Service] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Notification Service] Running on port ${PORT}`);
});
