const express = require("express");
const { processButlerChat } = require("../src/butler/orchestrator");
const { requireButlerEntitlement } = require("../src/butler/entitlement-guard");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "butler-orchestrator",
    status: "UP",
    timestamp: new Date().toISOString(),
  });
});

router.post("/", requireButlerEntitlement(), async (req, res) => {
  const authorization = req.headers?.authorization || "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || req.accessToken || null;
  const callerContext = {
    ...(req.accessContext || {}),
    accessToken,
    restaurantId:
      req.accessContext?.restaurantId ||
      req.claims?.restaurantId ||
      req.headers?.["x-restaurant-id"] ||
      req.body?.restaurantId ||
      req.query?.restaurantId,
    tableSessionId:
      req.accessContext?.tableSessionId ||
      req.claims?.tableSessionId ||
      req.body?.tableSessionId ||
      req.query?.tableSessionId ||
      null,
    permissions: req.accessContext?.permissions || req.claims?.privileges || [],
    role: req.accessContext?.role || req.claims?.role,
    roles: req.accessContext?.roles || req.claims?.roles || [],
    userId: req.accessContext?.userId || req.claims?.sub || null,
  };

  try {
    const response = await processButlerChat({
      message: req.body?.message,
      confirmation: req.body?.confirmation,
      conversationId: req.body?.conversationId,
      callerContext,
    });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      conversationId: req.body?.conversationId || null,
      reply: "Butler could not complete the request.",
      role: "assistant",
      error: {
        code: "MODEL_UNAVAILABLE",
        message: error.message || "Internal Butler error.",
      },
    });
  }
});

module.exports = router;
