const { createClient } = require("redis");

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error);
});

async function connectRedis() {
  await redisClient.connect();
  console.log("Redis connected");
}

module.exports = { redisClient, connectRedis };