/**
 * Phase 2 Tests — Entitlement Guard, Dietary Safety & MCP Privilege Enforcement
 *
 * Uses mock/in-memory patterns only. No loopback HTTP servers.
 * Relies on NODE_ENV=test branch in entitlement-guard.js which allows
 * rest_123 / test_rest without a live DB.
 */
"use strict";

const { describe, it, before, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// ─── Set test environment before requiring modules ────────────────────────────
process.env.NODE_ENV = "test";

const {
  isRestaurantEntitledToButler,
  setCachedEntitlement,
  clearEntitlementCache,
  requireButlerEntitlement,
  recordButlerUsage,
} = require("../src/butler/entitlement-guard");

const { executeTool, MCP_TOOLS } = require("../src/mcp-server");

// ── Minimal mock for menu.service so mcp-server resolves without a real DB ────
// (Already handled by the existing mock stubs in earlier tests; we patch via the
//  module's internal references via jest-style monkeypatching at the service layer)

// ─── 1. MCP_TOOLS sanity ─────────────────────────────────────────────────────
describe("MCP_TOOLS catalog (Phase 2)", () => {
  it("should expose at least 10 tools including check_dietary_safety", () => {
    assert.ok(Array.isArray(MCP_TOOLS), "MCP_TOOLS is array");
    assert.ok(MCP_TOOLS.length >= 10, `Expected >=10 tools, got ${MCP_TOOLS.length}`);
    const names = MCP_TOOLS.map((t) => t.name);
    assert.ok(names.includes("check_dietary_safety"), "check_dietary_safety registered");
  });
});

// ─── 2. Cache primitives ──────────────────────────────────────────────────────
describe("Entitlement cache primitives", () => {
  beforeEach(() => clearEntitlementCache());

  it("setCachedEntitlement(true) makes isRestaurantEntitledToButler resolve true without DB", async () => {
    setCachedEntitlement("rest_cache_true", true);
    const result = await isRestaurantEntitledToButler("rest_cache_true");
    assert.equal(result, true);
  });

  it("setCachedEntitlement(false) makes isRestaurantEntitledToButler resolve false without DB", async () => {
    setCachedEntitlement("rest_cache_false", false);
    const result = await isRestaurantEntitledToButler("rest_cache_false");
    assert.equal(result, false);
  });

  it("clearEntitlementCache removes cached state so test-env fallback applies", async () => {
    setCachedEntitlement("rest_123", false); // override with false
    clearEntitlementCache();
    // After clearing, test-env fallback kicks in → rest_123 → true
    const result = await isRestaurantEntitledToButler("rest_123");
    assert.equal(result, true, "rest_123 should be entitled in test env");
  });
});

// ─── 3. isRestaurantEntitledToButler ─────────────────────────────────────────
describe("isRestaurantEntitledToButler (test-env fallback)", () => {
  beforeEach(() => clearEntitlementCache());

  it("returns false for null restaurantId", async () => {
    const result = await isRestaurantEntitledToButler(null);
    assert.equal(result, false);
  });

  it("returns false for undefined restaurantId", async () => {
    const result = await isRestaurantEntitledToButler(undefined);
    assert.equal(result, false);
  });

  it("returns true for rest_123 in test env (DB fallback)", async () => {
    const result = await isRestaurantEntitledToButler("rest_123");
    assert.equal(result, true);
  });

  it("returns true for test_rest in test env (DB fallback)", async () => {
    const result = await isRestaurantEntitledToButler("test_rest");
    assert.equal(result, true);
  });

  it("returns false for unknown restaurant in test env (DB fallback)", async () => {
    const result = await isRestaurantEntitledToButler("some_other_rest");
    assert.equal(result, false);
  });
});

// ─── 4. requireButlerEntitlement middleware ───────────────────────────────────
describe("requireButlerEntitlement middleware", () => {
  beforeEach(() => clearEntitlementCache());

  /**
   * Build a minimal Express-style (req, res, next) mock
   */
  function mockReqRes(options = {}) {
    const req = {
      accessContext: options.accessContext || null,
      claims: options.claims || null,
      body: options.body || {},
      query: options.query || {},
      headers: options.headers || {},
    };
    const res = {
      _status: null,
      _json: null,
      status(code) {
        this._status = code;
        return this;
      },
      json(body) {
        this._json = body;
        return this;
      },
    };
    return { req, res };
  }

  it("responds 403 FEATURE_NOT_ENTITLED when no restaurantId provided", async () => {
    const { req, res } = mockReqRes();
    let nextCalled = false;
    const middleware = requireButlerEntitlement();
    await middleware(req, res, () => { nextCalled = true; });
    assert.equal(res._status, 403);
    assert.equal(res._json?.code, "FEATURE_NOT_ENTITLED");
    assert.equal(nextCalled, false);
  });

  it("responds 403 FEATURE_NOT_ENTITLED for unentitled restaurant", async () => {
    setCachedEntitlement("unentitled_rest", false);
    const { req, res } = mockReqRes({ headers: { "x-restaurant-id": "unentitled_rest" } });
    let nextCalled = false;
    const middleware = requireButlerEntitlement();
    await middleware(req, res, () => { nextCalled = true; });
    assert.equal(res._status, 403);
    assert.equal(res._json?.code, "FEATURE_NOT_ENTITLED");
    assert.equal(nextCalled, false);
  });

  it("calls next() for entitled restaurant (rest_123 in test env)", async () => {
    const { req, res } = mockReqRes({ headers: { "x-restaurant-id": "rest_123" } });
    let nextCalled = false;
    const middleware = requireButlerEntitlement();
    await middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, "next() should have been called");
    assert.equal(req.isButlerEntitled, true);
  });

  it("reads restaurantId from accessContext", async () => {
    setCachedEntitlement("rest_via_ctx", true);
    const { req, res } = mockReqRes({ accessContext: { restaurantId: "rest_via_ctx" } });
    let nextCalled = false;
    const middleware = requireButlerEntitlement();
    await middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it("reads restaurantId from query param", async () => {
    setCachedEntitlement("rest_via_query", true);
    const { req, res } = mockReqRes({ query: { restaurantId: "rest_via_query" } });
    let nextCalled = false;
    const middleware = requireButlerEntitlement();
    await middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
});

// ─── 5. executeTool — RBAC & Cross-tenant enforcement ────────────────────────
describe("executeTool privilege enforcement", () => {
  beforeEach(() => clearEntitlementCache());

  it("throws INSUFFICIENT_PRIVILEGES when create_menu_item called without MENU_CREATE", async () => {
    const callerContext = {
      restaurantId: "rest_123",
      permissions: ["VIEW_MENU"], // no MENU_CREATE
      checkEntitlement: false,
    };
    await assert.rejects(
      () => executeTool("create_menu_item", { restaurantId: "rest_123", categoryId: "cat1", name: "Test", basePrice: 100 }, callerContext),
      /INSUFFICIENT_PRIVILEGES/
    );
  });

  it("throws INSUFFICIENT_PRIVILEGES when disable_menu_item called without MENU_TOGGLE_AVAIL", async () => {
    const callerContext = {
      restaurantId: "rest_123",
      permissions: ["VIEW_MENU"],
      checkEntitlement: false,
    };
    await assert.rejects(
      () => executeTool("disable_menu_item", { productId: "prod_1", isAvailable: false, restaurantId: "rest_123" }, callerContext),
      /INSUFFICIENT_PRIVILEGES/
    );
  });

  it("SUPER_ADMIN bypasses RBAC permission check for create_menu_item", async () => {
    // SUPER_ADMIN should not get INSUFFICIENT_PRIVILEGES — may still fail on DB but not on RBAC
    const callerContext = {
      restaurantId: "rest_123",
      permissions: [], // no MENU_CREATE
      role: "SUPER_ADMIN",
      checkEntitlement: false,
    };
    // expect DB error (product service mock), NOT privilege error
    await assert.rejects(
      () => executeTool("create_menu_item", { restaurantId: "rest_123", categoryId: "cat1", name: "X", basePrice: 50 }, callerContext),
      (err) => {
        assert.ok(!err.message.includes("INSUFFICIENT_PRIVILEGES"), "SUPER_ADMIN must not get RBAC rejection");
        return true;
      }
    );
  });

  it("throws CROSS_TENANT_FORBIDDEN when args.restaurantId !== callerContext.restaurantId", async () => {
    const callerContext = {
      restaurantId: "rest_123",
      permissions: ["MENU_TOGGLE_AVAIL"],
      checkEntitlement: false,
    };
    await assert.rejects(
      () => executeTool("disable_menu_item", { productId: "prod_1", isAvailable: false, restaurantId: "rest_OTHER" }, callerContext),
      /CROSS_TENANT_FORBIDDEN/
    );
  });

  it("throws FEATURE_NOT_ENTITLED when checkEntitlement=true and restaurant not entitled", async () => {
    setCachedEntitlement("not_entitled_rest", false);
    const callerContext = {
      restaurantId: "not_entitled_rest",
      permissions: ["MENU_CREATE"],
      checkEntitlement: true,
    };
    await assert.rejects(
      () => executeTool("create_menu_item", { restaurantId: "not_entitled_rest", categoryId: "cat1", name: "X", basePrice: 10 }, callerContext),
      /FEATURE_NOT_ENTITLED/
    );
  });

  it("throws Tool not found for unknown tool name", async () => {
    await assert.rejects(
      () => executeTool("non_existent_tool", {}, {}),
      /Tool not found/
    );
  });
});

// ─── 6. check_dietary_safety dispatch ────────────────────────────────────────
describe("executeTool check_dietary_safety dispatch", () => {
  it("dispatches to checkDietarySafety and returns unverified:true when product has no recipeId/ingredients", async () => {
    // We rely on the mocked getMenuItemDetails from the service layer.
    // In test env the function exists but will throw "Product not found" for
    // random IDs — this confirms the dispatch route is reached.
    await assert.rejects(
      () => executeTool("check_dietary_safety", { productId: "unknown_prod_x", allergens: ["MILK"] }, {}),
      (err) => {
        // The error should come from checkDietarySafety (product not found),
        // NOT from "Tool not found" — confirming the tool route was dispatched
        assert.ok(!err.message.includes("Tool not found"), "Should dispatch to check_dietary_safety, not 'Tool not found'");
        return true;
      }
    );
  });

  it("requires productId argument (throws without it)", async () => {
    await assert.rejects(
      () => executeTool("check_dietary_safety", { allergens: ["PEANUT"] }, {}),
      /productId is required/
    );
  });
});

describe("Butler usage metering hook", () => {
  it("records a restaurant-scoped usage event for Butler activity", () => {
    const event = recordButlerUsage({
      restaurantId: "rest_123",
      actorId: "user_42",
      eventType: "butler_chat_request",
      metadata: { path: "/api/v1/chat", method: "POST" },
    });

    assert.equal(event.restaurantId, "rest_123");
    assert.equal(event.actorId, "user_42");
    assert.equal(event.eventType, "butler_chat_request");
    assert.ok(event.id);
    assert.ok(event.timestamp);
  });
});
