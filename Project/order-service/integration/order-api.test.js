const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { createApp } = require("../app");

const claims = { sub: "guest", type: "CUSTOMER", restaurantId: "r1", tableId: "t1", tableSessionId: "s1", privileges: ["ORDER_CREATE"] };

async function withServer(callback) {
  const order = { id: "o1", restaurantId: "r1", tableSessionId: "s1", total: 50 };
  const app = createApp({
    verifier: { verify: async (token) => { if (token === "valid") return claims; if (token === "closed") return { ...claims, tableSessionId: "s2" }; throw new Error("bad token"); } },
    checkout: { placeOrder: async () => order },
    repository: { findById: async () => order },
    sessionStore: { isActive: async (_restaurantId, _tableId, sessionId) => sessionId === "s1" },
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("order API requires a valid bearer token and returns created order", async () => {
  await withServer(async (base) => {
    const missing = await fetch(`${base}/`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(missing.status, 401);
    const created = await fetch(`${base}/`, { method: "POST", headers: { authorization: "Bearer valid", "content-type": "application/json" }, body: "{}" });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).data.id, "o1");
  });
});

test("customer can only read an order from the same active table session", async () => {
  await withServer(async (base) => {
    const allowed = await fetch(`${base}/o1`, { headers: { authorization: "Bearer valid" } });
    assert.equal(allowed.status, 200);
    const closed = await fetch(`${base}/o1`, { headers: { authorization: "Bearer closed" } });
    assert.equal(closed.status, 410);
  });
});
