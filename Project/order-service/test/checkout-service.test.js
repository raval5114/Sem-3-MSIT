const test = require("node:test");
const assert = require("node:assert/strict");
const { createCheckoutService, cents, selectOptions } = require("../src/checkout-service");

const claims = {
  sub: "guest_1", type: "CUSTOMER", restaurantId: "rest-1", tableId: "11111111-1111-4111-8111-111111111111",
  tableSessionId: "22222222-2222-4222-8222-222222222222", privileges: ["MENU_READ", "ORDER_CREATE"],
};
const product = {
  _id: "prod-1", restaurantId: "rest-1", name: "Masala Dosa", basePrice: 100,
  status: "ACTIVE", isAvailable: true, category: { isActive: true },
  variants: [{ _id: "variant-size", name: "Size", isActive: true, options: [
    { optionId: "large", name: "Large", priceAdjustment: 25, isAvailable: true },
    { optionId: "sold-out", name: "Sold out", priceAdjustment: 5, isAvailable: false },
  ] }],
  modifierGroups: [{ _id: "modifier-chutney", name: "Chutney", isActive: true, required: true, minimumSelection: 1, maximumSelection: 2, options: [
    { optionId: "coconut", name: "Coconut", priceAdjustment: 0, isAvailable: true },
    { optionId: "tomato", name: "Tomato", priceAdjustment: 10, isAvailable: true },
  ] }],
};

function fixture(overrides = {}) {
  let saved;
  const service = createCheckoutService({
    catalog: { getProductDetails: async () => product },
    repository: { create: async (order) => { saved = order; return order; } },
    sessionStore: { isActive: async () => true },
    idFactory: () => "33333333-3333-4333-8333-333333333333",
    ...overrides,
  });
  return { service, saved: () => saved };
}

test("server prices variants and modifiers and persists snapshots without accepting client totals", async () => {
  const { service, saved } = fixture();
  const placed = await service.placeOrder(claims, {
    paymentMethod: "PAY_AT_COUNTER", total: 0, items: [{ productId: "prod-1", quantity: 2,
      variantSelections: [{ variantId: "variant-size", optionId: "large" }],
      modifierSelections: [{ groupId: "modifier-chutney", optionIds: ["coconut", "tomato"] }],
    }],
  });
  assert.equal(placed.total, 270);
  assert.equal(placed.items[0].unitPrice, 135);
  assert.equal(placed.items[0].lineTotal, 270);
  assert.equal(placed.items[0].selections.length, 3);
  assert.equal(saved().paymentStatus, "UNPAID");
  assert.equal(saved().tableSessionId, claims.tableSessionId);
});

test("creates online payment order with PAYMENT_PENDING status and PENDING paymentStatus", async () => {
  const { service, saved } = fixture();
  const placed = await service.placeOrder(claims, {
    paymentMethod: "ONLINE",
    items: [{
      productId: "prod-1",
      quantity: 1,
      variantSelections: [{ variantId: "variant-size", optionId: "large" }],
      modifierSelections: [{ groupId: "modifier-chutney", optionIds: ["coconut"] }],
    }],
  });
  assert.equal(placed.paymentMethod, "ONLINE");
  assert.equal(placed.status, "PAYMENT_PENDING");
  assert.equal(placed.paymentStatus, "PENDING");
  assert.equal(saved().status, "PAYMENT_PENDING");
  assert.equal(saved().paymentStatus, "PENDING");
});

test("rejects unsupported payment method", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.placeOrder(claims, { paymentMethod: "BITCOIN", items: [{ productId: "prod-1", quantity: 1 }] }),
    (error) => error.code === "INVALID_PAYMENT_METHOD" && error.status === 422
  );
});

test("requires a customer token with ORDER_CREATE privilege", async () => {
  const { service } = fixture();
  await assert.rejects(service.placeOrder({ ...claims, privileges: ["MENU_READ"] }, { paymentMethod: "PAY_AT_COUNTER", items: [{ productId: "prod-1", quantity: 1 }] }),
    (error) => error.code === "CUSTOMER_TOKEN_REQUIRED");
});

test("rejects closed sessions and cross-restaurant or unavailable products", async () => {
  const closed = fixture({ sessionStore: { isActive: async () => false } });
  await assert.rejects(closed.service.placeOrder(claims, { paymentMethod: "PAY_AT_COUNTER", items: [{ productId: "prod-1", quantity: 1 }] }),
    (error) => error.code === "TABLE_SESSION_INACTIVE");
  const crossTenant = fixture({ catalog: { getProductDetails: async () => ({ ...product, restaurantId: "other" }) } });
  await assert.rejects(crossTenant.service.placeOrder(claims, { paymentMethod: "PAY_AT_COUNTER", items: [{ productId: "prod-1", quantity: 1 }] }),
    (error) => error.code === "MENU_ITEM_UNAVAILABLE");
});

test("rejects invalid quantities, missing required modifiers, and sold-out selections", async () => {
  const { service } = fixture();
  await assert.rejects(service.placeOrder(claims, { paymentMethod: "PAY_AT_COUNTER", items: [{ productId: "prod-1", quantity: 0 }] }));
  await assert.rejects(service.placeOrder(claims, { paymentMethod: "PAY_AT_COUNTER", items: [{ productId: "prod-1", quantity: 1 }] }), /Choose at least 1 option for Chutney/);
  assert.throws(() => selectOptions(product, { variantSelections: [{ variantId: "variant-size", optionId: "sold-out" }] }),
    (error) => error.code === "MENU_SELECTION_STALE");
});

test("enforces minimum selections even when the modifier group is not marked required", () => {
  const configured = { ...product, modifierGroups: [{ ...product.modifierGroups[0], required: false, minimumSelection: 2 }] };
  assert.throws(() => selectOptions(configured, { modifierSelections: [{ groupId: "modifier-chutney", optionIds: ["coconut"] }] }), /Choose at least 2 options/);
});

test("converts currency to cents without floating point drift and rejects invalid prices", () => {
  assert.equal(cents(0.1) + cents(0.2), 30);
  assert.throws(() => cents(-1), /Menu price is invalid/);
});
