const express = require("express");
const { createCheckoutService, CheckoutError } = require("./src/checkout-service");
const { validateTransition, OrderLifecycleError } = require("./src/order-lifecycle");
const { EffectiveAccessClient, EffectiveAccessError } = require("./src/effective-access-client");

function createApp({
  verifier,
  checkout,
  repository,
  sessionStore,
  redisPublisher = null,
  accessClient = new EffectiveAccessClient(),
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_req, res) => res.status(200).json({ service: "order-service", status: "UP", timestamp: new Date().toISOString() }));

  app.use(async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Bearer token required" });
    try {
      req.accessToken = match[1];
      req.claims = await verifier.verify(match[1]);
      return next();
    }
    catch (error) {
      if (error.message === "Auth key service is unavailable") return res.status(503).json({ success: false, code: "AUTH_KEYS_UNAVAILABLE", message: "Authentication service is temporarily unavailable" });
      return res.status(401).json({ success: false, code: "TOKEN_INVALID", message: "Bearer token is invalid or expired" });
    }
  });

  app.use(async (req, res, next) => {
    const claims = req.claims;
    if (claims.type !== "STAFF") return next();

    let requirement = null;
    if (req.path === "/kitchen/queue") {
      requirement = { featureKey: "KITCHEN_DISPLAY", permission: "ORDER_READ_ACTIVE" };
    } else if (req.method === "GET" && req.path === "/waiter/queue") {
      requirement = { featureKey: "WAITER_OPERATIONS", permission: "ORDER_READ_ACTIVE" };
    } else if (req.method === "PATCH" && /^\/waiter\/[^/]+\/serve$/.test(req.path)) {
      requirement = { featureKey: "WAITER_OPERATIONS", permission: "ORDER_UPDATE_STATUS" };
    } else if (req.method === "GET" && req.path === "/orders/active") {
      requirement = { featureKey: "ORDER_MANAGEMENT", permission: "ORDER_READ_ACTIVE" };
    } else if (req.method === "GET" && req.path === "/cashier/orders") {
      requirement = { featureKey: "CASHIER_OPERATIONS", permission: "ORDER_READ_ACTIVE" };
    } else if (req.path.startsWith("/analytics/")) {
      requirement = { featureKey: "ANALYTICS", permission: "TABLE_REVENUE_READ" };
    } else if (req.method === "PATCH" && req.path.endsWith("/status")) {
      const kitchenRoute = req.path.startsWith("/kitchen/");
      requirement = req.body?.status === "CANCELLED"
        ? { featureKey: kitchenRoute ? "KITCHEN_DISPLAY" : "ORDER_MANAGEMENT", permission: "ORDER_CANCEL" }
        : {
            featureKey: kitchenRoute ? "KITCHEN_DISPLAY" : "ORDER_MANAGEMENT",
            permission: "ORDER_UPDATE_STATUS",
          };
    } else if (req.method === "POST" && req.path === "/") {
      requirement = { featureKey: "ORDER_MANAGEMENT", permission: "ORDER_CREATE" };
    } else if (req.method === "GET" && /^\/[^/]+(?:\/status)?$/.test(req.path)) {
      requirement = { featureKey: "ORDER_MANAGEMENT", permission: "ORDER_READ_ACTIVE" };
    }

    if (!requirement) return next();
    try {
      const context = await accessClient.authorize({
        token: req.accessToken,
        restaurantId: claims.restaurantId,
        ...requirement,
      });
      claims.roles = context.role ? [context.role] : [];
      claims.privileges = context.permissions;
      return next();
    } catch (error) {
      const status = error instanceof EffectiveAccessError ? error.status : 503;
      return res.status(status).json({
        success: false,
        code: error.code || "ACCESS_POLICY_UNAVAILABLE",
        message: status === 503 ? "Authorization service is temporarily unavailable" : error.message,
      });
    }
  });

  const tableRevenueHandler = async (req, res, next) => {
    try {
      const claims = req.claims;
      const isSuperAdmin = claims.roles?.includes("SUPER_ADMIN");
      if (claims.type !== "STAFF") {
        throw new CheckoutError("Staff authorization required for revenue analytics", 403, "STAFF_TOKEN_REQUIRED");
      }
      if (!isSuperAdmin && !claims.privileges?.includes("TABLE_REVENUE_READ")) {
        throw new CheckoutError("Insufficient privilege to read table revenue", 403, "INSUFFICIENT_PRIVILEGES");
      }
      if (!claims.restaurantId) {
        throw new CheckoutError("Restaurant scope is required", 403, "RESTAURANT_SCOPE_REQUIRED");
      }

      const dateRange = parseRevenueDateRange(req.query);
      const tableId = req.params.tableId || "all";
      if (tableId !== "all" && await repository.checkCrossTenantTable({ restaurantId: claims.restaurantId, tableId })) {
        throw new CheckoutError("Table does not belong to this restaurant", 403, "CROSS_TENANT_FORBIDDEN");
      }
      const revenue = await repository.getTableRevenue({ restaurantId: claims.restaurantId, tableId, ...dateRange });
      return res.status(200).json({ success: true, data: revenue });
    } catch (error) { return next(error); }
  };

  app.get("/analytics/revenue", tableRevenueHandler);
  app.get("/analytics/tables/:tableId/revenue", tableRevenueHandler);

  const activeOrdersHandler = async (req, res, next) => {
    try {
      const claims = req.claims;
      if (claims.type !== "STAFF" && !claims.roles?.includes("SUPER_ADMIN")) {
        throw new CheckoutError("Staff authorization required to view active orders", 403, "STAFF_TOKEN_REQUIRED");
      }
      if (!claims.privileges?.includes("ORDER_READ_ACTIVE") && !claims.roles?.includes("SUPER_ADMIN")) {
        throw new CheckoutError("Insufficient privilege to read active orders", 403, "PERMISSION_DENIED");
      }
      const waiterWorkspace = req.path === "/waiter/queue";
      const assignedTableIds = waiterWorkspace
        ? await accessClient.assignedWaiterTableIds({ token: req.accessToken })
        : null;
      const cashierWorkspace = req.path === "/cashier/orders";
      const orders = await repository.findActiveOrdersByRestaurant(
        claims.restaurantId, assignedTableIds, cashierWorkspace);
      return res.status(200).json({ success: true, data: orders });
    } catch (error) { return next(error); }
  };
  app.get("/kitchen/queue", activeOrdersHandler);
  app.get("/waiter/queue", activeOrdersHandler);
  app.get("/orders/active", activeOrdersHandler);
  app.get("/cashier/orders", activeOrdersHandler);

  app.post("/", async (req, res, next) => {
    try {
      const order = await checkout.placeOrder(req.claims, req.body);
      return res.status(201).json({ success: true, data: order });
    } catch (error) { return next(error); }
  });

  // Status-only check for polling / reconnect catch-up (available to both customer and staff)
  app.get("/:orderId/status", async (req, res, next) => {
    try {
      const claims = req.claims;
      const statusInfo = await repository.findStatusById(req.params.orderId);
      if (!statusInfo || statusInfo.restaurantId !== claims.restaurantId) {
        return res.status(404).json({ success: false, code: "ORDER_NOT_FOUND", message: "Order not found" });
      }
      if (claims.type === "CUSTOMER" && statusInfo.tableSessionId !== claims.tableSessionId) {
        return res.status(403).json({ success: false, code: "CROSS_SESSION_FORBIDDEN", message: "Access denied" });
      }
      return res.status(200).json({ success: true, data: statusInfo });
    } catch (error) { return next(error); }
  });

  // Update order status (Kitchen status transitions)
  const updateStatusHandler = async (req, res, next) => {
    try {
      const claims = req.claims;
      if (claims.type !== "STAFF" && !claims.roles?.includes("SUPER_ADMIN")) {
        throw new CheckoutError("Staff authorization required to update order status", 403, "STAFF_TOKEN_REQUIRED");
      }
      const targetStatus = req.body?.status;
      if (!targetStatus) {
        throw new CheckoutError("New status is required", 400, "MISSING_STATUS");
      }
      const existing = await repository.findById(req.params.orderId);
      if (!existing || existing.restaurantId !== claims.restaurantId) {
        return res.status(404).json({ success: false, code: "ORDER_NOT_FOUND", message: "Order not found" });
      }
      if (req.path.startsWith("/waiter/")) {
        const assignedTableIds = await accessClient.assignedWaiterTableIds({ token: req.accessToken });
        if (!assignedTableIds.includes(existing.tableId)) {
          throw new CheckoutError("This order is not on a table assigned to you", 403, "TABLE_NOT_ASSIGNED");
        }
      }

      // Enforce valid lifecycle transitions and staff privileges
      validateTransition(existing.status, targetStatus, claims);

      const updated = await repository.updateStatus(existing.id, targetStatus);

      if (redisPublisher && typeof redisPublisher.publish === "function") {
        try {
          await redisPublisher.publish(
            "order_events",
            JSON.stringify({
              event: "ORDER_STATUS_CHANGED",
              orderId: updated.id,
              restaurantId: updated.restaurantId,
              tableId: updated.tableId,
              tableSessionId: updated.tableSessionId,
              previousStatus: existing.status,
              newStatus: targetStatus,
              updatedAt: new Date().toISOString(),
            })
          );
        } catch {
          // Non-blocking publish error
        }
      }

      return res.status(200).json({ success: true, data: updated });
    } catch (error) { return next(error); }
  };

  app.patch("/:orderId/status", updateStatusHandler);
  app.patch("/kitchen/:orderId/status", updateStatusHandler);
  app.patch("/waiter/:orderId/serve", (req, res, next) => {
    req.body = { ...req.body, status: "SERVED" };
    return updateStatusHandler(req, res, next);
  });

  app.get("/:orderId", async (req, res, next) => {
    try {
      const claims = req.claims;
      const order = await repository.findById(req.params.orderId);
      if (!order || order.restaurantId !== claims.restaurantId) {
        return res.status(404).json({ success: false, code: "ORDER_NOT_FOUND", message: "Order not found" });
      }
      if (claims.type === "CUSTOMER") {
        if (!claims.tableSessionId) throw new CheckoutError("A customer table-session token is required", 403, "CUSTOMER_TOKEN_REQUIRED");
        if (!await sessionStore.isActive(claims.restaurantId, claims.tableId, claims.tableSessionId)) throw new CheckoutError("This table session is closed or expired", 410, "TABLE_SESSION_INACTIVE");
        if (order.tableSessionId !== claims.tableSessionId) {
          return res.status(404).json({ success: false, code: "ORDER_NOT_FOUND", message: "Order not found for this table session" });
        }
      }
      return res.status(200).json({ success: true, data: order });
    } catch (error) { return next(error); }
  });

  app.use((error, _req, res, _next) => {
    const status = error instanceof CheckoutError || error instanceof OrderLifecycleError ? error.status : (error.status || 500);
    return res.status(status).json({ success: false, code: error.code || "ORDER_ERROR", message: status === 500 ? "Order service could not complete the request" : error.message });
  });
  return app;
}

function parseRevenueDateRange(query) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const from = query.from || defaultFrom;
  const to = query.to || today;
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!validDate(from) || !validDate(to)) {
    throw new CheckoutError("Dates must use YYYY-MM-DD format", 400, "INVALID_DATE_FORMAT");
  }
  if (from > to) throw new CheckoutError("The start date must be on or before the end date", 400, "INVALID_DATE_RANGE");
  return { from, to };
}

module.exports = { createApp, createCheckoutService, parseRevenueDateRange };
