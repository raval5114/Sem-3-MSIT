const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
const { createClient } = require("redis");
require("dotenv").config();

const { createApp } = require("./app");
const { JwtVerifier } = require("./src/jwt-verifier");
const { getPaymentProvider } = require("./src/providers/provider-factory");
const { createPaymentRepository } = require("./src/payment-repository");
const { createPaymentService } = require("./src/payment-service");
const { createSessionStore } = require("./src/session-store");

const PORT = process.env.PORT || 3003;

async function start() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URI });
  const redis = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT || 6379),
    },
  });
  redis.on("error", (error) => console.error("[Payment Service] Redis error:", error.message));

  try {
    const migration = await fs.readFile(path.join(__dirname, "db/001_payments.sql"), "utf8");
    await pool.query(migration);

    await redis.connect().catch((err) => {
      console.warn("[Payment Service] Redis connect failed (operating in standalone mode):", err.message);
    });

    const provider = getPaymentProvider();
    const repository = createPaymentRepository(pool);
    const sessionStore = createSessionStore(redis);
    const verifier = new JwtVerifier();

    const paymentService = createPaymentService({
      provider,
      repository,
      sessionStore,
      redisPublisher: redis.isOpen ? redis : null,
    });

    const app = createApp({ verifier, paymentService });
    const server = app.listen(PORT, () => console.log(`[Payment Service] Running on port ${PORT} (Provider: ${provider.name})`));

    const shutdown = async () => {
      server.close();
      if (redis.isOpen) await redis.quit();
      await pool.end();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("[Payment Service] Startup failed:", error.message);
    await pool.end();
    if (redis.isOpen) await redis.quit();
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = { start };
