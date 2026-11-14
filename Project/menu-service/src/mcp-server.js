const crypto = require("node:crypto");
const { getProfileData } = require("../service/user.service");
const {
  searchMenu,
  getMenuItemDetails,
  createMenuItem,
  updateMenuItem,
  toggleMenuItemAvailability,
  getCustomerCatalog,
  getOrder,
  getTableStatus,
  getKitchenStatus,
  checkDietarySafety,
} = require("../service/menu.service");
const { isRestaurantEntitledToButler, recordButlerUsage } = require("./butler/entitlement-guard");

/**
 * Model Context Protocol (MCP) Server
 * Conforms to JSON-RPC 2.0 and MCP specification over HTTP SSE / POST.
 */

const BUTLER_CART_STORE = new Map();
const ORDER_SERVICE_BASE_URL = process.env.ORDER_SERVICE_BASE_URL || "http://localhost:3002";

async function getCustomerCartSnapshot({ restaurantId, tableSessionId, callerContext = {} } = {}) {
  if (!restaurantId) throw new Error("restaurantId is required");
  if (callerContext.tableSessionId && tableSessionId && callerContext.tableSessionId !== tableSessionId) {
    throw new Error("CROSS_SESSION_FORBIDDEN: The cart session does not match the caller context.");
  }
  const key = `${restaurantId}:${tableSessionId || "guest"}`;
  const snapshot = BUTLER_CART_STORE.get(key) || { restaurantId, tableSessionId: tableSessionId || null, items: [], total: 0, currency: "INR" };
  return {
    ...snapshot,
    total: Number(snapshot.total || 0),
    items: Array.isArray(snapshot.items) ? snapshot.items : [],
  };
}

async function finalizeCustomerOrder({ restaurantId, tableSessionId, paymentMethod = "PAY_AT_COUNTER", items = [], idempotencyKey, accessToken, callerContext = {} } = {}) {
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!tableSessionId) throw new Error("tableSessionId is required");
  if (callerContext.tableSessionId && callerContext.tableSessionId !== tableSessionId) {
    throw new Error("CROSS_SESSION_FORBIDDEN: The order session does not match the caller context.");
  }
  if (!Array.isArray(items) || items.length === 0) throw new Error("At least one cart item is required to place an order");
  if (!accessToken) throw new Error("AUTH_REQUIRED: A valid access token is required to submit a Butler-backed order.");

  const normalizedItems = [];
  let total = 0;

  for (const item of items) {
    const productId = item.productId || item.id;
    if (!productId) throw new Error("Each cart item needs a productId");

    const product = await getMenuItemDetails(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);
    if (product.restaurantId && product.restaurantId !== restaurantId) {
      throw new Error("CROSS_TENANT_FORBIDDEN: Order item belongs to a different restaurant.");
    }
    if (product.isAvailable === false || product.status === "INACTIVE") {
      throw new Error(`Product unavailable: ${product.name || productId}`);
    }

    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(product.basePrice || 0);
    const lineTotal = unitPrice * quantity;
    total += lineTotal;

    normalizedItems.push({
      productId,
      name: product.name,
      quantity,
      unitPrice,
      lineTotal,
      selections: Array.isArray(item.selections) ? item.selections : [],
    });
  }

  const response = await fetch(`${ORDER_SERVICE_BASE_URL}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      restaurantId,
      tableSessionId,
      paymentMethod,
      items: normalizedItems,
      idempotencyKey: idempotencyKey || `butler-${Date.now()}`,
      total,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    const message = payload?.message || `Order service rejected submit order: ${response.status}`;
    throw new Error(message);
  }

  const cartKey = `${restaurantId}:${tableSessionId}`;
  BUTLER_CART_STORE.delete(cartKey);

  recordButlerUsage({
    restaurantId,
    actorId: "customer",
    eventType: "butler_order_submission",
    metadata: {
      itemCount: normalizedItems.length,
      orderId: payload.data?.id,
      tableSessionId,
      total,
    },
  });

  return payload.data;
}

// Tool Definitions with JSON Schemas
const MCP_TOOLS = [
  {
    name: "get_user_profile",
    description: "Get user metadata, membership tier, and login history.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The unique ID or subject of the user account",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "search_menu",
    description:
      "Search available dishes and menu items by keyword query, category, price range, dietary tags, and allergen exclusions.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword or dish name to search in name and description",
        },
        categoryId: {
          type: "string",
          description: "Filter items by category ID",
        },
        minPrice: {
          type: "number",
          description: "Minimum base price filter in INR",
        },
        maxPrice: {
          type: "number",
          description: "Maximum base price filter in INR",
        },
        dietaryTags: {
          type: "array",
          items: { type: "string" },
          description: "List of dietary requirements (e.g. ['vegetarian', 'vegan', 'high-protein'])",
        },
        excludeAllergens: {
          type: "array",
          items: { type: "string" },
          description: "List of allergen codes to exclude (e.g. ['MILK', 'PEANUT', 'WHEAT'])",
        },
        restaurantId: {
          type: "string",
          description: "Restaurant identifier scope",
        },
      },
    },
  },
  {
    name: "get_menu_item",
    description:
      "Get comprehensive details of a specific menu product, including base price, options, variants, modifier groups, and preparation time.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "Unique ID of the product",
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "create_menu_item",
    description:
      "Create a new menu item for a restaurant. Requires MENU_CREATE staff privilege.",
    inputSchema: {
      type: "object",
      properties: {
        restaurantId: {
          type: "string",
          description: "Owning restaurant ID",
        },
        categoryId: {
          type: "string",
          description: "Parent category ID",
        },
        name: {
          type: "string",
          description: "Name of the dish or menu product",
        },
        basePrice: {
          type: "number",
          description: "Base price in INR",
        },
        description: {
          type: "string",
          description: "Culinary description of the item",
        },
        dietaryTags: {
          type: "array",
          items: { type: "string" },
          description: "Tags like vegetarian, vegan, spicy",
        },
        spiceLevel: {
          type: "number",
          description: "Spice level from 0 to 5",
        },
        preparationTimeMinutes: {
          type: "number",
          description: "Estimated preparation time in minutes",
        },
      },
      required: ["restaurantId", "categoryId", "name", "basePrice"],
    },
  },
  {
    name: "disable_menu_item",
    description:
      "Toggle availability of a menu product (e.g. mark out-of-stock or in-stock). Requires MENU_TOGGLE_AVAIL staff privilege.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "Product ID to update",
        },
        isAvailable: {
          type: "boolean",
          description: "True if available to order; false if sold out",
        },
      },
      required: ["productId", "isAvailable"],
    },
  },
  {
    name: "get_customer_catalog",
    description:
      "Retrieve the full categorized customer menu catalog for a restaurant, with all active products and options.",
    inputSchema: {
      type: "object",
      properties: {
        restaurantId: {
          type: "string",
          description: "The unique ID of the restaurant",
        },
      },
      required: ["restaurantId"],
    },
  },
  {
    name: "get_order",
    description:
      "Retrieve the current status, items, subtotal, and total for an order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The unique UUID of the order",
        },
      },
      required: ["orderId"],
    },
  },
  {
    name: "get_table_status",
    description:
      "Inspect the current status, active session, and availability for a restaurant table.",
    inputSchema: {
      type: "object",
      properties: {
        tableId: {
          type: "string",
          description: "The UUID of the table",
        },
        restaurantId: {
          type: "string",
          description: "The restaurant ID",
        },
      },
      required: ["tableId"],
    },
  },
  {
    name: "get_kitchen_status",
    description:
      "List all currently active orders progressing through kitchen preparation stages.",
    inputSchema: {
      type: "object",
      properties: {
        restaurantId: {
          type: "string",
          description: "The restaurant ID",
        },
      },
      required: ["restaurantId"],
    },
  },
  {
    name: "check_dietary_safety",
    description:
      "Inspect ingredient composition and allergen flags for a dish. Reports unknown/unverified ingredients if data is incomplete.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "The ID of the product to inspect",
        },
        allergens: {
          type: "array",
          items: { type: "string" },
          description: "List of allergens to check against",
        },
      },
      required: ["productId", "allergens"],
    },
  },
  {
    name: "get_customer_cart",
    description: "Read the current Butler cart snapshot for a restaurant table session without mutating the order.",
    inputSchema: {
      type: "object",
      properties: {
        restaurantId: { type: "string", description: "Restaurant identifier scope" },
        tableSessionId: { type: "string", description: "Current customer table session" },
      },
      required: ["restaurantId", "tableSessionId"],
    },
  },
  {
    name: "submit_customer_order",
    description: "Finalize a Butler order draft against the order service with session ownership and price revalidation.",
    inputSchema: {
      type: "object",
      properties: {
        restaurantId: { type: "string", description: "Restaurant identifier scope" },
        tableSessionId: { type: "string", description: "Current customer table session" },
        paymentMethod: { type: "string", enum: ["PAY_AT_COUNTER", "ONLINE"], description: "Payment method for the final order" },
        items: {
          type: "array",
          description: "Cart items to validate and submit",
          items: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "number" },
              selections: { type: "array", items: { type: "object" } },
            },
            required: ["productId", "quantity"],
          },
        },
        idempotencyKey: { type: "string", description: "Unique idempotency key to prevent duplicates" },
      },
      required: ["restaurantId", "tableSessionId", "items"],
    },
  },
];

/**
 * Tool Execution Dispatcher
 */
async function executeTool(name, args = {}, callerContext = {}) {
  const restaurantId = callerContext.restaurantId || args.restaurantId;

  // Enforce feature entitlement if required or caller specifies check
  if (callerContext.checkEntitlement && restaurantId) {
    const entitled = await isRestaurantEntitledToButler(restaurantId);
    if (!entitled) {
      throw new Error(
        `FEATURE_NOT_ENTITLED: Butler AI Assistant is not enabled for restaurant '${restaurantId}'.`
      );
    }
  }

  // Enforce RBAC permission checks if caller context includes permissions
  if (callerContext.permissions && Array.isArray(callerContext.permissions)) {
    const isSuperAdmin = callerContext.role === "SUPER_ADMIN" || callerContext.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin) {
      if (name === "create_menu_item" && !callerContext.permissions.includes("MENU_CREATE")) {
        throw new Error("INSUFFICIENT_PRIVILEGES: User lacks required MENU_CREATE permission.");
      }
      if (name === "disable_menu_item" && !callerContext.permissions.includes("MENU_TOGGLE_AVAIL")) {
        throw new Error("INSUFFICIENT_PRIVILEGES: User lacks required MENU_TOGGLE_AVAIL permission.");
      }
    }
  }

  // Cross-tenant protection: if caller is scoped to a restaurant, prevent cross-tenant operations
  if (callerContext.restaurantId && args.restaurantId && args.restaurantId !== callerContext.restaurantId) {
    throw new Error("CROSS_TENANT_FORBIDDEN: Target restaurant does not match caller membership.");
  }

  switch (name) {
    case "get_user_profile": {
      const data = await getProfileData(args.userId);
      return data;
    }
    case "search_menu": {
      const data = await searchMenu(args);
      return data;
    }
    case "get_menu_item": {
      const data = await getMenuItemDetails(args.productId);
      if (!data) throw new Error(`Product not found: ${args.productId}`);
      return data;
    }
    case "create_menu_item": {
      const data = await createMenuItem(args);
      return data;
    }
    case "disable_menu_item": {
      const data = await toggleMenuItemAvailability(args.productId, args.isAvailable);
      return data;
    }
    case "get_customer_catalog": {
      const data = await getCustomerCatalog(args.restaurantId);
      return data;
    }
    case "get_order": {
      const data = await getOrder(args.orderId);
      if (!data) throw new Error(`Order not found: ${args.orderId}`);
      return data;
    }
    case "get_table_status": {
      const data = await getTableStatus(args.tableId, args.restaurantId);
      return data;
    }
    case "get_kitchen_status": {
      const data = await getKitchenStatus(args.restaurantId);
      return data;
    }
    case "check_dietary_safety": {
      const data = await checkDietarySafety(args.productId, args.allergens);
      return data;
    }
    case "get_customer_cart": {
      const data = await getCustomerCartSnapshot({
        restaurantId: args.restaurantId || callerContext.restaurantId,
        tableSessionId: args.tableSessionId || callerContext.tableSessionId,
        callerContext,
      });
      return data;
    }
    case "submit_customer_order": {
      const data = await finalizeCustomerOrder({
        restaurantId: args.restaurantId || callerContext.restaurantId,
        tableSessionId: args.tableSessionId || callerContext.tableSessionId,
        paymentMethod: args.paymentMethod || "PAY_AT_COUNTER",
        items: args.items,
        idempotencyKey: args.idempotencyKey,
        accessToken: callerContext.accessToken,
        callerContext,
      });
      return data;
    }
    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

/**
 * Handle JSON-RPC 2.0 Request
 */
async function handleJsonRpc(request, callerContext = {}) {
  const { jsonrpc, id, method, params } = request || {};

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "dineflow-mcp-server",
          version: "1.0.0",
        },
      },
    };
  }

  if (method === "notifications/initialized" || method === "ping") {
    return {
      jsonrpc: "2.0",
      id,
      result: {},
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    try {
      const data = await executeTool(toolName, toolArgs, callerContext);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: typeof data === "string" ? data : JSON.stringify(data),
            },
          ],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: error.message || "Tool execution failed",
            },
          ],
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
    },
  };
}

/**
 * In-memory registry of active SSE connections
 */
const activeSessions = new Map();

function registerSseSession(res) {
  const sessionId = crypto.randomUUID();
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  // Emit initial endpoint handshake event as required by SSE transport specification
  res.write(`event: endpoint\ndata: /mcp/messages?sessionId=${sessionId}\n\n`);

  activeSessions.set(sessionId, res);

  res.on("close", () => {
    activeSessions.delete(sessionId);
  });

  return sessionId;
}

function getSseSession(sessionId) {
  return activeSessions.get(sessionId);
}

module.exports = {
  MCP_TOOLS,
  executeTool,
  handleJsonRpc,
  registerSseSession,
  getSseSession,
};
