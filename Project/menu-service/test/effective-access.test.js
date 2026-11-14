const test = require("node:test");
const assert = require("node:assert/strict");
const { requireMenuAccess } = require("../src/effective-access");

function runMiddleware({ fetchImpl, body = {}, query = {}, method = "POST", path = "/" }) {
  const req = {
    body,
    query,
    method,
    path,
    get: (name) => name.toLowerCase() === "authorization" ? "Bearer staff-token" : undefined,
  };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  return Promise.resolve(requireMenuAccess({ fetchImpl })(req, res, () => { nextCalled = true; }))
    .then(() => ({ req, res, nextCalled }));
}

test("menu access binds writes to the authenticated restaurant", async () => {
  const { req, res, nextCalled } = await runMiddleware({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        allowed: true,
        context: { restaurantId: "DF-1", role: "RESTAURANT_ADMIN" },
      }),
    }),
    body: { name: "Lunch" },
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.restaurantId, "DF-1");
  assert.equal(req.accessContext.restaurantId, "DF-1");
});

test("menu access rejects a supplied cross-tenant filter", async () => {
  const { res, nextCalled } = await runMiddleware({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        allowed: true,
        context: { restaurantId: "DF-1" },
      }),
    }),
    method: "GET",
    query: { restaurantId: "DF-2" },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, "CROSS_TENANT_FORBIDDEN");
});

test("menu access fails closed when Auth is unavailable", async () => {
  const { res, nextCalled } = await runMiddleware({
    fetchImpl: async () => { throw new Error("offline"); },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.code, "ACCESS_POLICY_UNAVAILABLE");
});
