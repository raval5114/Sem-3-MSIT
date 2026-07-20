const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'order-service',
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// Root / API Status
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Order Management Microservice is operational',
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`[Order Service] Running on port ${PORT}`);
});