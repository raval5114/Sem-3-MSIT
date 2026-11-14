const express = require("express");
const {
  MCP_TOOLS,
  handleJsonRpc,
  registerSseSession,
  getSseSession,
  executeTool,
} = require("../src/mcp-server");

const router = express.Router();

/**
 * MCP Server-Sent Events (SSE) Transport Handshake
 * GET /mcp/sse
 */
router.get("/sse", (req, res) => {
  const sessionId = registerSseSession(res);
  console.log(`[MCP] Client connected via SSE. Session: ${sessionId}`);
});

/**
 * MCP Messages Endpoint
 * POST /mcp/messages?sessionId=<uuid>
 */
router.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const sseRes = sessionId ? getSseSession(sessionId) : null;
  const callerContext = {
    ...(req.accessContext || {}),
    restaurantId:
      req.accessContext?.restaurantId ||
      req.claims?.restaurantId ||
      req.headers?.["x-restaurant-id"] ||
      req.query?.restaurantId,
  };

  try {
    const jsonRpcResponse = await handleJsonRpc(req.body, callerContext);

    // If active SSE stream exists, also notify the client via SSE message event
    if (sseRes && !sseRes.writableEnded) {
      sseRes.write(`event: message\ndata: ${JSON.stringify(jsonRpcResponse)}\n\n`);
    }

    // Always respond to the HTTP POST request with the JSON-RPC response
    return res.status(200).json(jsonRpcResponse);
  } catch (error) {
    return res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: error.message || "Internal error",
      },
    });
  }
});

/**
 * Direct JSON-RPC Endpoint (for HTTP MCP Clients)
 * POST /mcp
 */
router.post("/", async (req, res) => {
  const callerContext = {
    ...(req.accessContext || {}),
    restaurantId:
      req.accessContext?.restaurantId ||
      req.claims?.restaurantId ||
      req.headers?.["x-restaurant-id"] ||
      req.query?.restaurantId,
  };

  try {
    const jsonRpcResponse = await handleJsonRpc(req.body, callerContext);
    return res.status(200).json(jsonRpcResponse);
  } catch (error) {
    return res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: error.message || "Internal error",
      },
    });
  }
});

/**
 * REST Discovery of Tools
 * GET /mcp/tools
 */
router.get("/tools", (req, res) => {
  return res.status(200).json({
    success: true,
    count: MCP_TOOLS.length,
    tools: MCP_TOOLS,
  });
});

/**
 * Direct REST invocation of any MCP Tool
 * POST /mcp/tools/:toolName
 */
router.post("/tools/:toolName", async (req, res) => {
  const { toolName } = req.params;
  try {
    const result = await executeTool(toolName, req.body || {}, req.accessContext || {});
    return res.status(200).json({
      success: true,
      tool: toolName,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      tool: toolName,
      error: error.message || "Tool execution failed",
    });
  }
});

module.exports = router;
