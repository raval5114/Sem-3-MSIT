const test = require("node:test");
const assert = require("node:assert/strict");
const { createSessionStore } = require("../src/session-store");

test("requires both table pointer and session status to match", async () => {
  const values = new Map([
    ["dineflow:restaurant:r1:table:t1:active-session", "s1"],
    ["dineflow:table-session:s1", "ACTIVE"],
  ]);
  const store = createSessionStore({ get: async (key) => values.get(key) ?? null });
  assert.equal(await store.isActive("r1", "t1", "s1"), true);
  assert.equal(await store.isActive("r1", "t1", "s2"), false);
  values.set("dineflow:table-session:s1", "CLOSED");
  assert.equal(await store.isActive("r1", "t1", "s1"), false);
});
