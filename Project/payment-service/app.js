const express = require("express");
const { PaymentError } = require("./src/payment-service");

function createApp({ verifier, paymentService }) {
  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Razorpay-Signature, Stripe-Signature, X-Dineflow-Signature");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });

  // Preserve rawBody for HMAC webhook verification
  app.use(
    express.json({
      limit: "64kb",
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    })
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ service: "payment-service", status: "UP", timestamp: new Date().toISOString() });
  });

  // Webhook endpoint: does NOT require JWT bearer token; verifies webhook signature header instead
  app.post("/webhook", async (req, res, next) => {
    try {
      const signature =
        req.get("x-razorpay-signature") ||
        req.get("stripe-signature") ||
        req.get("x-dineflow-signature") ||
        req.body?.signature ||
        "";
      const result = await paymentService.handleWebhook({
        rawBody: req.rawBody,
        signature,
        payload: req.body,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  });

  // Authenticated routes middleware
  const requireAuth = async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Bearer token required" });
    }
    try {
      req.claims = await verifier.verify(match[1]);
      return next();
    } catch (error) {
      if (error.message === "Auth key service is unavailable") {
        return res.status(503).json({ success: false, code: "AUTH_KEYS_UNAVAILABLE", message: "Authentication service is temporarily unavailable" });
      }
      return res.status(401).json({ success: false, code: "TOKEN_INVALID", message: "Bearer token is invalid or expired" });
    }
  };

  app.post("/create-intent", requireAuth, async (req, res, next) => {
    try {
      const intent = await paymentService.createIntent(req.claims, req.body);
      return res.status(200).json({ success: true, data: intent });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/verify", requireAuth, async (req, res, next) => {
    try {
      const result = await paymentService.verifyPayment(req.claims, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/order/:orderId", requireAuth, async (req, res, next) => {
    try {
      const payments = await paymentService.getPaymentByOrderId(req.claims, req.params.orderId);
      return res.status(200).json({ success: true, data: payments });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/refund", requireAuth, async (req, res, next) => {
    try {
      const result = await paymentService.refundPayment(req.claims, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    const status = error instanceof PaymentError ? error.status : (error.status || 500);
    return res.status(status).json({
      success: false,
      code: error.code || "PAYMENT_ERROR",
      message: status === 500 ? "Payment service could not complete the request" : error.message,
    });
  });

  return app;
}

module.exports = { createApp };

