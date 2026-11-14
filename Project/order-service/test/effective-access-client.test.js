const test = require("node:test");
const assert = require("node:assert/strict");
const { EffectiveAccessClient, EffectiveAccessError } = require("../src/effective-access-client");

test("effective access client forwards the caller token and scoped action", async () => {
  let received;
  const client = new EffectiveAccessClient({
    baseUrl: "http://auth.test/",
    fetchImpl: async (url, options) => {
      received = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          allowed: true,
          context: { role: "CHEF", permissions: ["ORDER_READ_ACTIVE"] },
        }),
      };
    },
  });

  const context = await client.authorize({
    token: "staff-token",
    restaurantId: "DF-1",
    featureKey: "KITCHEN_DISPLAY",
    permission: "ORDER_READ_ACTIVE",
  });

  assert.equal(received.url, "http://auth.test/auth/access/authorize");
  assert.equal(received.options.headers.Authorization.slice(-11), "staff-token");
  assert.deepEqual(JSON.parse(received.options.body), {
    restaurantId: "DF-1",
    featureKey: "KITCHEN_DISPLAY",
    permission: "ORDER_READ_ACTIVE",
  });
  assert.deepEqual(context.permissions, ["ORDER_READ_ACTIVE"]);
});

test("effective access client fails closed when Auth is unavailable", async () => {
  const client = new EffectiveAccessClient({
    fetchImpl: async () => { throw new Error("connection refused"); },
  });
  await assert.rejects(
    client.authorize({
      token: "staff-token",
      restaurantId: "DF-1",
      featureKey: "ORDER_MANAGEMENT",
      permission: "ORDER_READ_ACTIVE",
    }),
    (error) => error instanceof EffectiveAccessError
      && error.status === 503
      && error.code === "ACCESS_POLICY_UNAVAILABLE"
  );
});

test("effective access client reads waiter assignments using the authenticated token", async () => {
  let received;
  const client = new EffectiveAccessClient({
    baseUrl: "http://auth.test/",
    fetchImpl: async (url, options) => {
      received = { url, options };
      return { ok: true, status: 200, json: async () => [{ id: "table-1" }, { id: "table-2" }] };
    },
  });

  const ids = await client.assignedWaiterTableIds({ token: "waiter-token" });

  assert.equal(received.url, "http://auth.test/auth/waiter/tables");
  assert.equal(received.options.headers.Authorization.slice(-12), "waiter-token");
  assert.deepEqual(ids, ["table-1", "table-2"]);
});
