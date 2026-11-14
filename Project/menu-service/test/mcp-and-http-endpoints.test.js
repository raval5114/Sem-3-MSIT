const test = require("node:test");
const assert = require("node:assert/strict");
const { getProfileData } = require("../service/user.service");
const {
  MCP_TOOLS,
  executeTool,
  handleJsonRpc,
} = require("../src/mcp-server");
const userRoutes = require("../routes/user.routes");
const menuSearchRoutes = require("../routes/menu.routes");
const mcpRoutes = require("../routes/mcp.routes");

// Helper to simulate Express request/response in-memory
function simulateRequest(router, req) {
  return new Promise((resolve) => {
    let statusCode = 200;
    const headers = {};
    let responseBody = null;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      writeHead(code, head) {
        statusCode = code;
        Object.assign(headers, head);
        return this;
      },
      setHeader(k, v) {
        headers[k] = v;
      },
      write(chunk) {
        responseBody = (responseBody || "") + chunk;
      },
      json(data) {
        responseBody = data;
        resolve({ status: statusCode, body: data, headers });
      },
      send(data) {
        responseBody = data;
        resolve({ status: statusCode, body: data, headers });
      },
      on(event, handler) {
        // no-op for close event
      },
    };

    router(req, res, (err) => {
      if (err) resolve({ status: 500, error: err });
      else resolve({ status: statusCode, body: responseBody, headers });
    });
  });
}

test("User Profile Service: returns consistent metadata as required by MCP specification", async () => {
  const profile = await getProfileData("usr_12345");
  assert.equal(profile.userId, "usr_12345");
  assert.equal(profile.status, "Active");
  assert.equal(profile.tier, "Premium");
  assert.ok(profile.lastLogin);
});

test("MCP Tool Registry: lists all required tools and valid schemas", async () => {
  const toolNames = MCP_TOOLS.map((t) => t.name);
  assert.ok(toolNames.includes("get_user_profile"));
  assert.ok(toolNames.includes("search_menu"));
  assert.ok(toolNames.includes("get_menu_item"));
  assert.ok(toolNames.includes("create_menu_item"));
  assert.ok(toolNames.includes("disable_menu_item"));
  assert.ok(toolNames.includes("get_customer_catalog"));
  assert.ok(toolNames.includes("get_order"));
  assert.ok(toolNames.includes("get_table_status"));
  assert.ok(toolNames.includes("get_kitchen_status"));

  for (const tool of MCP_TOOLS) {
    assert.equal(typeof tool.name, "string");
    assert.equal(typeof tool.description, "string");
    assert.equal(tool.inputSchema.type, "object");
  }
});

test("MCP JSON-RPC: handles 'initialize' method", async () => {
  const res = await handleJsonRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
  });
  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 1);
  assert.equal(res.result.serverInfo.name, "dineflow-mcp-server");
  assert.ok(res.result.capabilities.tools);
});

test("MCP JSON-RPC: handles 'tools/list' method", async () => {
  const res = await handleJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 2);
  assert.ok(Array.isArray(res.result.tools));
  assert.ok(res.result.tools.length >= 9);
});

test("MCP JSON-RPC: executes 'tools/call' for get_user_profile", async () => {
  const res = await handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_user_profile",
      arguments: { userId: "usr_998877" },
    },
  });
  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 3);
  assert.ok(Array.isArray(res.result.content));
  const payload = JSON.parse(res.result.content[0].text);
  assert.equal(payload.userId, "usr_998877");
  assert.equal(payload.tier, "Premium");
});

test("MCP JSON-RPC: returns error for unknown tool", async () => {
  const res = await handleJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "non_existent_tool",
      arguments: {},
    },
  });
  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 4);
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /Tool not found/);
});

test("HTTP REST: GET /api/users/:id endpoint returns profile", async () => {
  const res = await simulateRequest(userRoutes, {
    method: "GET",
    url: "/usr_test_1",
    params: { id: "usr_test_1" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.userId, "usr_test_1");
  assert.equal(res.body.status, "Active");
});

test("HTTP REST: GET /mcp/tools returns all tools", async () => {
  const res = await simulateRequest(mcpRoutes, {
    method: "GET",
    url: "/tools",
    params: {},
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.tools.length >= 9);
});

test("HTTP REST: POST /mcp/tools/:toolName executes tool directly", async () => {
  const res = await simulateRequest(mcpRoutes, {
    method: "POST",
    url: "/tools/get_user_profile",
    params: { toolName: "get_user_profile" },
    body: { userId: "usr_direct_test" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.userId, "usr_direct_test");
});

test("HTTP REST: POST /mcp handles direct JSON-RPC payload", async () => {
  const res = await simulateRequest(mcpRoutes, {
    method: "POST",
    url: "/",
    body: {
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: {
        name: "get_user_profile",
        arguments: { userId: "usr_rpc_test" },
      },
    },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.jsonrpc, "2.0");
  assert.equal(res.body.id, 99);
  const data = JSON.parse(res.body.result.content[0].text);
  assert.equal(data.userId, "usr_rpc_test");
});
