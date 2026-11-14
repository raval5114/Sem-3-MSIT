const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BUTLER_TOOLS,
  CHAT_ERROR_CODES,
  validateToolArgs,
  createDraftAction,
} = require("../src/butler/contracts");

test("Butler Contracts: exports standard chat error codes", () => {
  assert.equal(CHAT_ERROR_CODES.FEATURE_NOT_ENTITLED, "FEATURE_NOT_ENTITLED");
  assert.equal(CHAT_ERROR_CODES.INSUFFICIENT_PRIVILEGES, "INSUFFICIENT_PRIVILEGES");
  assert.equal(CHAT_ERROR_CODES.AUTH_REQUIRED, "AUTH_REQUIRED");
});

test("Butler Contracts: tool catalog includes all release tools", () => {
  const tools = Object.keys(BUTLER_TOOLS);
  assert.ok(tools.includes("search_menu"));
  assert.ok(tools.includes("create_menu_item"));
  assert.ok(tools.includes("disable_menu_item"));
  assert.ok(tools.includes("get_order"));
  assert.ok(tools.includes("get_kitchen_status"));
  assert.ok(tools.includes("get_table_status"));
  assert.ok(tools.includes("check_dietary_safety"));
});

test("Butler Contracts: validates required fields accurately", () => {
  // Missing required fields
  assert.throws(() => {
    validateToolArgs("create_menu_item", { name: "Pizza" });
  }, /Missing required field 'categoryId'/);

  // Valid required fields
  const valid = validateToolArgs("create_menu_item", {
    categoryId: "cat_1",
    name: "Pizza",
    basePrice: 399,
  });
  assert.equal(valid, true);
});

test("Butler Contracts: creates structured draft action with expiration metadata", () => {
  const draft = createDraftAction(
    "create_menu_item",
    { categoryId: "cat_1", name: "Pasta", basePrice: 299 },
    "Create Pasta for INR 299"
  );
  assert.ok(draft.actionId.startsWith("act_"));
  assert.equal(draft.toolName, "create_menu_item");
  assert.equal(draft.requiresConfirmation, true);
  assert.equal(draft.payload.basePrice, 299);
});
