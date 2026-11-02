const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTransition, VALID_TRANSITIONS, OrderLifecycleError } = require("../src/order-lifecycle");

const chefClaims = {
  sub: "chef_1",
  type: "STAFF",
  roles: ["CHEF"],
  privileges: ["ORDER_READ_ACTIVE", "ORDER_UPDATE_STATUS"],
};

const adminClaims = {
  sub: "admin_1",
  type: "STAFF",
  roles: ["RESTAURANT_ADMIN"],
  privileges: ["ORDER_READ_ACTIVE", "ORDER_UPDATE_STATUS", "ORDER_CANCEL"],
};

const guestClaims = {
  sub: "guest_1",
  type: "CUSTOMER",
  privileges: ["MENU_READ", "ORDER_CREATE"],
};

test("order-lifecycle: permits sequential progress through kitchen stages", () => {
  assert.equal(validateTransition("SUBMITTED", "ACCEPTED", chefClaims), true);
  assert.equal(validateTransition("PENDING_KITCHEN", "ACCEPTED", chefClaims), true);
  assert.equal(validateTransition("ACCEPTED", "PREPARING", chefClaims), true);
  assert.equal(validateTransition("PREPARING", "READY", chefClaims), true);
  assert.equal(validateTransition("READY", "SERVED", chefClaims), true);
  assert.equal(validateTransition("SERVED", "COMPLETED", chefClaims), true);
});

test("order-lifecycle: permits cancellation by authorized staff with ORDER_CANCEL privilege", () => {
  assert.equal(validateTransition("SUBMITTED", "CANCELLED", adminClaims), true);
  assert.equal(validateTransition("ACCEPTED", "CANCELLED", adminClaims), true);

  // Chef without ORDER_CANCEL cannot cancel
  assert.throws(
    () => validateTransition("ACCEPTED", "CANCELLED", chefClaims),
    (err) => err.code === "PERMISSION_DENIED" && err.status === 403
  );
});

test("order-lifecycle: rejects out-of-order and invalid transitions", () => {
  // Cannot jump from SUBMITTED directly to READY
  assert.throws(
    () => validateTransition("SUBMITTED", "READY", chefClaims),
    (err) => err.code === "INVALID_ORDER_TRANSITION" && err.status === 409
  );

  // Cannot move backward from READY to PREPARING
  assert.throws(
    () => validateTransition("READY", "PREPARING", chefClaims),
    (err) => err.code === "INVALID_ORDER_TRANSITION" && err.status === 409
  );

  // Cannot transition a COMPLETED or CANCELLED order
  assert.throws(
    () => validateTransition("COMPLETED", "ACCEPTED", chefClaims),
    (err) => err.code === "INVALID_ORDER_TRANSITION" && err.status === 409
  );
  assert.throws(
    () => validateTransition("CANCELLED", "ACCEPTED", chefClaims),
    (err) => err.code === "INVALID_ORDER_TRANSITION" && err.status === 409
  );
});

test("order-lifecycle: rejects customer role from updating kitchen statuses", () => {
  assert.throws(
    () => validateTransition("ACCEPTED", "PREPARING", guestClaims),
    (err) => err.code === "PERMISSION_DENIED" && err.status === 403
  );
});

