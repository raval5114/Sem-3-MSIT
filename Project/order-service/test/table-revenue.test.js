const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createApp } = require("../app");

function createMockApp({ claims, revenueData, crossTenant = false }) {
  const verifier = {
    verify: async (token) => {
      if (token === "invalid") throw new Error("Invalid token");
      return claims;
    },
  };
  const repository = {
    getTableRevenue: async (params) => {
      if (typeof revenueData === "function") return revenueData(params);
      return revenueData;
    },
    checkCrossTenantTable: async () => crossTenant,
  };
  const sessionStore = { isActive: async () => true };
  const checkout = {};
  return createApp({ verifier, checkout, repository, sessionStore });
}

async function makeRequest(app, path, token) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    const json = await res.json();
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

test("table-revenue: rejects unauthenticated requests with 401", async () => {
  const app = createMockApp({ claims: {} });
  const res = await makeRequest(app, "/analytics/tables/t1/revenue");
  assert.equal(res.status, 401);
  assert.equal(res.body.code, "AUTH_REQUIRED");
});

test("table-revenue: rejects customer tokens with 403 STAFF_TOKEN_REQUIRED", async () => {
  const app = createMockApp({
    claims: { type: "CUSTOMER", restaurantId: "r1", tableId: "t1" },
  });
  const res = await makeRequest(app, "/analytics/tables/t1/revenue", "valid-token");
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "STAFF_TOKEN_REQUIRED");
});

test("table-revenue: rejects staff tokens without TABLE_REVENUE_READ privilege", async () => {
  const app = createMockApp({
    claims: {
      type: "STAFF",
      restaurantId: "r1",
      roles: ["WAITER"],
      privileges: ["ORDER_READ_ACTIVE"],
    },
  });
  const res = await makeRequest(app, "/analytics/tables/t1/revenue", "valid-token");
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "INSUFFICIENT_PRIVILEGES");
});

test("table-revenue: accepts staff token with TABLE_REVENUE_READ and calculates revenue accurately", async () => {
  let receivedParams = null;
  const mockRevenue = {
    tableId: "t1",
    period: { from: "2026-10-01", to: "2026-10-31" },
    completedOrders: 42,
    grossRevenue: 18650.0,
    refunds: 350.0,
    netRevenue: 18300.0,
    currency: "INR",
  };

  const app = createMockApp({
    claims: {
      sub: "u_staff_1",
      email: "manager@dineflow.com",
      type: "STAFF",
      restaurantId: "r1",
      roles: ["RESTAURANT_ADMIN"],
      privileges: ["TABLE_REVENUE_READ"],
    },
    revenueData: (params) => {
      receivedParams = params;
      return mockRevenue;
    },
  });

  const res = await makeRequest(
    app,
    "/analytics/tables/t1/revenue?from=2026-10-01&to=2026-10-31",
    "valid-token"
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.completedOrders, 42);
  assert.equal(res.body.data.grossRevenue, 18650.0);
  assert.equal(res.body.data.refunds, 350.0);
  assert.equal(res.body.data.netRevenue, 18300.0);
  assert.equal(res.body.data.currency, "INR");
  assert.equal(receivedParams.restaurantId, "r1");
  assert.equal(receivedParams.tableId, "t1");
});

test("table-revenue: permits SUPER_ADMIN role without explicit TABLE_REVENUE_READ privilege", async () => {
  const app = createMockApp({
    claims: {
      sub: "u_super_1",
      type: "STAFF",
      restaurantId: "r1",
      roles: ["SUPER_ADMIN"],
      privileges: [],
    },
    revenueData: {
      period: { from: "2026-10-01", to: "2026-10-31" },
      completedOrders: 10,
      grossRevenue: 5000,
      refunds: 0,
      netRevenue: 5000,
      currency: "INR",
    },
  });
  const res = await makeRequest(app, "/analytics/revenue", "valid-token");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.grossRevenue, 5000);
});

test("table-revenue: rejects invalid date formats and invalid date range", async () => {
  const app = createMockApp({
    claims: {
      type: "STAFF",
      restaurantId: "r1",
      privileges: ["TABLE_REVENUE_READ"],
    },
  });

  const resInvalidFormat = await makeRequest(
    app,
    "/analytics/tables/t1/revenue?from=not-a-date",
    "valid-token"
  );
  assert.equal(resInvalidFormat.status, 400);
  assert.equal(resInvalidFormat.body.code, "INVALID_DATE_FORMAT");

  const resInvalidRange = await makeRequest(
    app,
    "/analytics/tables/t1/revenue?from=2026-10-31&to=2026-10-01",
    "valid-token"
  );
  assert.equal(resInvalidRange.status, 400);
  assert.equal(resInvalidRange.body.code, "INVALID_DATE_RANGE");
});

test("table-revenue: rejects cross-tenant table access", async () => {
  const app = createMockApp({
    claims: {
      type: "STAFF",
      restaurantId: "r1",
      privileges: ["TABLE_REVENUE_READ"],
    },
    crossTenant: true,
  });

  const res = await makeRequest(
    app,
    "/analytics/tables/t_victim/revenue",
    "valid-token"
  );
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "CROSS_TENANT_FORBIDDEN");
});

