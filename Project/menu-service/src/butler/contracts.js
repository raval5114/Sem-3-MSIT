/**
 * Butler Agent Protocol & Tool Contracts (Phase 1)
 * Derived from context/butler_contracts_and_schemas.md
 */

const CHAT_ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FEATURE_NOT_ENTITLED: "FEATURE_NOT_ENTITLED",
  INSUFFICIENT_PRIVILEGES: "INSUFFICIENT_PRIVILEGES",
  CROSS_TENANT_FORBIDDEN: "CROSS_TENANT_FORBIDDEN",
  ACTION_EXPIRED: "ACTION_EXPIRED",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  INVALID_ARGUMENTS: "INVALID_ARGUMENTS",
};

const BUTLER_TOOLS = {
  search_menu: {
    name: "search_menu",
    description:
      "Search available dishes and menu items by keyword query, category, price range, dietary tags, and allergen exclusions.",
    isMutation: false,
    requiredPrivilege: null, // Scoped to active restaurant, available to diners & staff
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        categoryId: { type: "string" },
        minPrice: { type: "number" },
        maxPrice: { type: "number" },
        dietaryTags: { type: "array", items: { type: "string" } },
        excludeAllergens: { type: "array", items: { type: "string" } },
      },
    },
  },

  get_menu_item: {
    name: "get_menu_item",
    description:
      "Get comprehensive details of a specific menu product, including base price, options, variants, modifier groups, and preparation time.",
    isMutation: false,
    requiredPrivilege: null,
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
      },
      required: ["productId"],
    },
  },

  create_menu_item: {
    name: "create_menu_item",
    description:
      "Create a new menu item for a restaurant. Requires MENU_CREATE staff privilege and explicit user confirmation.",
    isMutation: true,
    requiredPrivilege: "MENU_CREATE",
    inputSchema: {
      type: "object",
      properties: {
        categoryId: { type: "string" },
        name: { type: "string" },
        basePrice: { type: "number" },
        description: { type: "string" },
        dietaryTags: { type: "array", items: { type: "string" } },
        spiceLevel: { type: "number" },
        preparationTimeMinutes: { type: "number" },
      },
      required: ["categoryId", "name", "basePrice"],
    },
  },

  disable_menu_item: {
    name: "disable_menu_item",
    description:
      "Toggle availability of a menu product (e.g. mark out-of-stock or in-stock). Requires MENU_TOGGLE_AVAIL staff privilege and confirmation.",
    isMutation: true,
    requiredPrivilege: "MENU_TOGGLE_AVAIL",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        isAvailable: { type: "boolean" },
      },
      required: ["productId", "isAvailable"],
    },
  },

  get_order: {
    name: "get_order",
    description: "Retrieve current order details, status, line items, and totals.",
    isMutation: false,
    requiredPrivilege: "ORDER_READ_ACTIVE",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
      },
      required: ["orderId"],
    },
  },

  get_kitchen_status: {
    name: "get_kitchen_status",
    description: "Inspect orders currently in the kitchen preparation queue.",
    isMutation: false,
    requiredPrivilege: "ORDER_READ_ACTIVE",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  get_table_status: {
    name: "get_table_status",
    description: "Check table seating status, occupancy, and active session ID.",
    isMutation: false,
    requiredPrivilege: "TABLE_MANAGE",
    inputSchema: {
      type: "object",
      properties: {
        tableId: { type: "string" },
      },
      required: ["tableId"],
    },
  },

  check_dietary_safety: {
    name: "check_dietary_safety",
    description:
      "Inspect ingredient composition and allergen flags for a dish. Reports unknown/unverified ingredients if data is incomplete.",
    isMutation: false,
    requiredPrivilege: null,
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        allergens: { type: "array", items: { type: "string" } },
      },
      required: ["productId", "allergens"],
    },
  },
};

/**
 * Validates tool arguments against defined schema
 */
function validateToolArgs(toolName, args = {}) {
  const tool = BUTLER_TOOLS[toolName];
  if (!tool) {
    throw new Error(`Tool not recognized in Butler tool catalog: ${toolName}`);
  }

  const { required = [] } = tool.inputSchema;
  for (const field of required) {
    if (args[field] === undefined || args[field] === null || args[field] === "") {
      throw new Error(`Missing required field '${field}' for tool '${toolName}'`);
    }
  }

  return true;
}

/**
 * Creates a structured draft action awaiting client review/confirmation
 */
function createDraftAction(toolName, payload, summary) {
  const tool = BUTLER_TOOLS[toolName];
  if (!tool) throw new Error(`Unknown tool for draft: ${toolName}`);

  return {
    actionId: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    toolName,
    summary,
    payload,
    requiresConfirmation: true,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  CHAT_ERROR_CODES,
  BUTLER_TOOLS,
  validateToolArgs,
  createDraftAction,
};
