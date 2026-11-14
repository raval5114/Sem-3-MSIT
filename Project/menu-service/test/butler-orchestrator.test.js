const test = require("node:test");
const assert = require("node:assert/strict");

const { processButlerChat } = require("../src/butler/orchestrator");

test("Butler orchestrator rejects chat without restaurant context", async () => {
  const result = await processButlerChat({
    message: "Find me a vegetarian dish under 400",
    callerContext: {},
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, "FEATURE_NOT_ENTITLED");
});

test("Butler orchestrator drafts a menu item before confirmation", async () => {
  const result = await processButlerChat({
    message: "Create Paneer Pizza for ₹299 in category cat_1",
    callerContext: {
      restaurantId: "rest_123",
      permissions: ["MENU_CREATE"],
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.draftAction.toolName, "create_menu_item");
  assert.equal(result.draftAction.payload.basePrice, 299);
  assert.ok(result.reply.includes("draft") || result.reply.includes("I can create"));
});

test("Butler orchestrator executes a confirmed menu mutation draft", async () => {
  const draftResult = await processButlerChat({
    message: "Create Paneer Pizza for ₹299 in category cat_1",
    callerContext: {
      restaurantId: "rest_123",
      permissions: ["MENU_CREATE"],
    },
  });

  assert.ok(draftResult.draftAction?.actionId);

  const confirmed = await processButlerChat({
    confirmation: {
      actionId: draftResult.draftAction.actionId,
      confirmed: false,
    },
    conversationId: draftResult.conversationId,
    callerContext: {
      restaurantId: "rest_123",
      permissions: ["MENU_CREATE"],
    },
  });

  assert.equal(confirmed.success, true);
  assert.equal(confirmed.toolCalls[0].status, "AWAITING_CONFIRMATION");
});

test("Butler orchestrator does not persist a menu mutation before explicit confirmation", async () => {
  const draftResult = await processButlerChat({
    message: "Create Paneer Pizza for ₹299 in category cat_1",
    callerContext: {
      restaurantId: "rest_123",
      permissions: ["MENU_CREATE"],
    },
  });

  assert.equal(draftResult.success, true);
  assert.ok(draftResult.draftAction?.actionId);
  assert.equal(draftResult.result, undefined);
  assert.equal(draftResult.toolCalls[0].status, "AWAITING_CONFIRMATION");
});

test("Butler orchestrator rejects duplicate confirmation for the same draft action", async () => {
  const draftResult = await processButlerChat({
    message: "Create Paneer Pizza for ₹299 in category cat_1",
    callerContext: {
      restaurantId: "rest_123",
      permissions: ["MENU_CREATE"],
    },
  });

  const handledDraft = await processButlerChat({
    confirmation: {
      actionId: draftResult.draftAction.actionId,
      confirmed: false,
    },
    conversationId: draftResult.conversationId,
    callerContext: {
      restaurantId: "rest_123",
      permissions: ["MENU_CREATE"],
    },
  });

  assert.equal(handledDraft.success, true);
  assert.equal(handledDraft.toolCalls[0].status, "AWAITING_CONFIRMATION");

  const duplicateConfirmation = await processButlerChat({
    confirmation: {
      actionId: draftResult.draftAction.actionId,
      confirmed: true,
    },
    conversationId: draftResult.conversationId,
    callerContext: {
      restaurantId: "rest_123",
      permissions: ["MENU_CREATE"],
    },
  });

  assert.equal(duplicateConfirmation.success, false);
  assert.equal(duplicateConfirmation.error.code, "ACTION_EXPIRED");
});
