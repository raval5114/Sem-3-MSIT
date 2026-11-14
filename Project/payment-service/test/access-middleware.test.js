const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createApp } = require("../app");

async function request(app, path, body = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("staff payment routes use fresh Auth permissions rather than JWT privileges", async () => {
  let receivedClaims;
  let requestData;
  const app = createApp({
    verifier: { verify: async () => ({
      type: "STAFF",
      restaurantId: "DF-1",
      privileges: [],
    }) },
    accessClient: {
      authorize: async (request) => {
        requestData = request;
        return { role: "CASHIER", permissions: ["PAYMENT_PROCESS"] };
      },
    },
    paymentService: {
      createIntent: async (claims) => {
        receivedClaims = claims;
        return { paymentId: "p1" };
      },
    },
  });

  const result = await request(app, "/create-intent", { orderId: "o1" });
  assert.equal(result.status, 200);
  assert.equal(requestData.featureKey, "CASHIER_OPERATIONS");
  assert.equal(requestData.permission, "PAYMENT_PROCESS");
  assert.deepEqual(receivedClaims.privileges, ["PAYMENT_PROCESS"]);
});

test("staff payment routes fail closed when the authorization policy is unavailable", async () => {
  const app = createApp({
    verifier: { verify: async () => ({ type: "STAFF", restaurantId: "DF-1" }) },
    accessClient: { authorize: async () => { throw new Error("offline"); } },
    paymentService: { createIntent: async () => assert.fail("payment must not run") },
  });

  const result = await request(app, "/create-intent", { orderId: "o1" });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "ACCESS_POLICY_UNAVAILABLE");
});

test("cashier counter payment requires the current Auth permission and records payment for the current staff", async () => {
  let recordedClaims;
  let receivedPolicy;
  const app = createApp({
    verifier: { verify: async () => ({
      sub: "cashier-user",
      type: "STAFF",
      restaurantId: "DF-1",
      privileges: [],
    }) },
    accessClient: {
      authorize: async (request) => {
        receivedPolicy = request;
        return { role: "CASHIER", permissions: ["PAYMENT_PROCESS"] };
      },
    },
    paymentService: {
      recordCashPayment: async (claims, request) => {
        recordedClaims = claims;
        return { ...request, status: "PAID" };
      },
    },
  });

  const result = await request(app, "/counter-payment", {
    orderId: "order-1",
    idempotencyKey: "cash-request-1",
  });

  assert.equal(result.status, 200);
  assert.equal(receivedPolicy.featureKey, "CASHIER_OPERATIONS");
  assert.equal(receivedPolicy.permission, "PAYMENT_PROCESS");
  assert.deepEqual(recordedClaims.privileges, ["PAYMENT_PROCESS"]);
  assert.equal(recordedClaims.roles[0], "CASHIER");
});
