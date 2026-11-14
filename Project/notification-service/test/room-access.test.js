const test = require("node:test");
const assert = require("node:assert/strict");
const { canJoinRoom, roomForClaims } = require("../src/room-access");

test("staff room is scoped to the restaurant in the authenticated claims", () => {
  const claims = { type: "STAFF", restaurantId: "DF-1" };
  assert.equal(roomForClaims(claims), "kitchen:DF-1");
  assert.equal(canJoinRoom(claims, "kitchen:DF-1"), true);
  assert.equal(canJoinRoom(claims, "kitchen:DF-2"), false);
  assert.equal(canJoinRoom(claims, "order:123"), false);
});

test("customer room is scoped to its table session", () => {
  const claims = { type: "CUSTOMER", tableSessionId: "session-1" };
  assert.equal(roomForClaims(claims), "table:session-1");
  assert.equal(canJoinRoom(claims, "table:session-1"), true);
  assert.equal(canJoinRoom(claims, "table:session-2"), false);
});
