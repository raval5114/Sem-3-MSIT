const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createApp } = require("../app");
const { EffectiveAccessError } = require("../src/effective-access-client");

function createRoleApp({ claims, orders = [], failPermission = null, assignedTableIds = ["table-1"] }) {
  const requirements = [];
  let updatedStatus = null;
  const repository = {
    findActiveOrdersByRestaurant: async (restaurantId, tableIds, includeUnpaid) => {
      assert.equal(restaurantId, claims.restaurantId);
      if (includeUnpaid) return orders.filter((order) => order.status !== "CANCELLED");
      return Array.isArray(tableIds) ? orders.filter((order) => tableIds.includes(order.tableId)) : orders;
    },
    findById: async (id) => ({
      id,
      restaurantId: claims.restaurantId,
      tableId: "table-1",
      tableSessionId: "session-1",
      status: "READY",
    }),
    updateStatus: async (_id, status) => {
      updatedStatus = status;
      return { id: "order-1", restaurantId: claims.restaurantId, status };
    },
  };
  const app = createApp({
    verifier: { verify: async () => claims },
    checkout: {},
    repository,
    sessionStore: { isActive: async () => true },
    accessClient: {
      authorize: async (requirement) => {
        requirements.push(requirement);
        if (requirement.permission === failPermission) {
          throw new EffectiveAccessError("Permission denied", 403, "PERMISSION_DENIED");
        }
        return { role: claims.roles[0], permissions: claims.privileges };
      },
      assignedWaiterTableIds: async () => assignedTableIds,
    },
  });
  return { app, requirements, getUpdatedStatus: () => updatedStatus };
}

async function request(app, path, method = "GET") {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      ...(method === "PATCH" ? { body: JSON.stringify({}) } : {}),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

test("waiter queue uses the waiter entitlement and current active-order permission", async () => {
  const { app, requirements } = createRoleApp({
    claims: { type: "STAFF", restaurantId: "restaurant-a", roles: ["WAITER"], privileges: ["ORDER_READ_ACTIVE"] },
    orders: [{ id: "order-1", tableId: "table-1", status: "READY" }],
  });
  const result = await request(app, "/waiter/queue");
  assert.equal(result.status, 200);
  assert.equal(result.body.data[0].id, "order-1");
  assert.equal(requirements[0].featureKey, "WAITER_OPERATIONS");
  assert.equal(requirements[0].permission, "ORDER_READ_ACTIVE");
});

test("waiter serve action is scoped to the waiter feature and only advances to SERVED", async () => {
  const { app, requirements, getUpdatedStatus } = createRoleApp({
    claims: {
      type: "STAFF",
      restaurantId: "restaurant-a",
      roles: ["WAITER"],
      privileges: ["ORDER_READ_ACTIVE", "ORDER_UPDATE_STATUS"],
    },
  });
  const result = await request(app, "/waiter/order-1/serve", "PATCH");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.status, "SERVED");
  assert.equal(getUpdatedStatus(), "SERVED");
  assert.equal(requirements[0].featureKey, "WAITER_OPERATIONS");
  assert.equal(requirements[0].permission, "ORDER_UPDATE_STATUS");
});

test("waiter queue only returns orders for assigned tables", async () => {
  const { app } = createRoleApp({
    claims: { type: "STAFF", restaurantId: "restaurant-a", roles: ["WAITER"], privileges: ["ORDER_READ_ACTIVE"] },
    orders: [
      { id: "assigned-order", tableId: "table-1" },
      { id: "other-order", tableId: "table-2" },
    ],
    assignedTableIds: ["table-1"],
  });
  const result = await request(app, "/waiter/queue");
  assert.deepEqual(result.body.data.map((order) => order.id), ["assigned-order"]);
});

test("waiter cannot serve an order at an unassigned table", async () => {
  const { app, getUpdatedStatus } = createRoleApp({
    claims: {
      type: "STAFF",
      restaurantId: "restaurant-a",
      roles: ["WAITER"],
      privileges: ["ORDER_READ_ACTIVE", "ORDER_UPDATE_STATUS"],
    },
    assignedTableIds: ["another-table"],
  });
  const result = await request(app, "/waiter/order-1/serve", "PATCH");
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "TABLE_NOT_ASSIGNED");
  assert.equal(getUpdatedStatus(), null);
});

test("cashier order workspace denies access when the cashier permission is missing", async () => {
  const { app, requirements } = createRoleApp({
    claims: { type: "STAFF", restaurantId: "restaurant-a", roles: ["CASHIER"], privileges: ["ORDER_READ_ACTIVE"] },
    failPermission: "ORDER_READ_ACTIVE",
  });
  const result = await request(app, "/cashier/orders");
  assert.equal(result.status, 403);
  assert.equal(requirements[0].featureKey, "CASHIER_OPERATIONS");
});

test("cashier workspace returns restaurant orders only after current payment and order permissions pass", async () => {
  const { app, requirements } = createRoleApp({
    claims: {
      type: "STAFF",
      restaurantId: "restaurant-a",
      roles: ["CASHIER"],
      privileges: ["PAYMENT_PROCESS", "ORDER_READ_ACTIVE"],
    },
    orders: [{ id: "order-2", paymentStatus: "UNPAID" }],
  });
  const result = await request(app, "/cashier/orders");
  assert.equal(result.status, 200);
  assert.equal(result.body.data[0].paymentStatus, "UNPAID");
  assert.equal(requirements[0].featureKey, "CASHIER_OPERATIONS");
  assert.equal(requirements[0].permission, "ORDER_READ_ACTIVE");
});

test("customer tokens cannot read staff order workspaces even if claims contain the order permission", async () => {
  const { app, requirements } = createRoleApp({
    claims: { type: "CUSTOMER", restaurantId: "restaurant-a", roles: ["CUSTOMER_GUEST"], privileges: ["ORDER_READ_ACTIVE"] },
  });
  const result = await request(app, "/cashier/orders");
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "STAFF_TOKEN_REQUIRED");
  assert.equal(requirements.length, 0);
});
