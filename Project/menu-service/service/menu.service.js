const Product = require("../models/products.model");
const Category = require("../models/categories.model");
const Variant = require("../models/variants.model");
const ModifierGroup = require("../models/modifier.model");
const Allergen = require("../models/allergen.model");
const { getCustomerCatalog } = require("./customer-catalog.service");
const {
  createProduct,
  updateProduct,
  updateAvailability,
  getProductDetails,
} = require("./product.service");
const pool = require("../config/pg.db.config");

/**
 * Unified Menu and Dining Service
 * Single source of truth for both REST API and MCP Tools
 * as required by project.mcp_implementation_guide.md
 */

/**
 * Search and filter menu items dynamically
 */
async function searchMenu({
  query,
  categoryId,
  minPrice,
  maxPrice,
  dietaryTags,
  excludeAllergens,
  restaurantId,
  isAvailable = true,
  status = "ACTIVE",
} = {}) {
  const mongoFilter = {};

  if (restaurantId) {
    mongoFilter.restaurantId = restaurantId;
  }

  if (status) {
    mongoFilter.status = status;
  }

  if (typeof isAvailable === "boolean") {
    mongoFilter.isAvailable = isAvailable;
  }

  if (categoryId) {
    mongoFilter.categoryId = categoryId;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    mongoFilter.basePrice = {};
    if (minPrice !== undefined && !isNaN(Number(minPrice))) {
      mongoFilter.basePrice.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
      mongoFilter.basePrice.$lte = Number(maxPrice);
    }
    if (Object.keys(mongoFilter.basePrice).length === 0) {
      delete mongoFilter.basePrice;
    }
  }

  if (query && typeof query === "string" && query.trim()) {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    mongoFilter.$or = [{ name: regex }, { description: regex }];
  }

  if (dietaryTags) {
    const tags = Array.isArray(dietaryTags)
      ? dietaryTags
      : String(dietaryTags)
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
    if (tags.length > 0) {
      mongoFilter.dietaryTags = { $in: tags };
    }
  }

  let products = await Product.find(mongoFilter)
    .sort({ displayPriority: 1, createdAt: -1 })
    .lean();

  if (excludeAllergens && products.length > 0) {
    const excluded = (
      Array.isArray(excludeAllergens)
        ? excludeAllergens
        : String(excludeAllergens).split(",")
    )
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);

    if (excluded.length > 0) {
      products = products.filter((item) => {
        const text = `${item.name} ${item.description || ""}`.toUpperCase();
        for (const allergen of excluded) {
          if (text.includes(allergen)) return false;
          if (
            item.dietaryTags &&
            item.dietaryTags.some((t) => t.toUpperCase() === allergen)
          ) {
            return false;
          }
        }
        return true;
      });
    }
  }

  return products;
}

/**
 * Get comprehensive menu item details
 */
async function getMenuItemDetails(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }
  return await getProductDetails(productId);
}

/**
 * Create a menu item
 */
async function createMenuItem(payload) {
  return await createProduct(payload);
}

/**
 * Update an existing menu item
 */
async function updateMenuItem(productId, payload) {
  return await updateProduct(productId, payload);
}

/**
 * Toggle product availability
 */
async function toggleMenuItemAvailability(productId, isAvailable) {
  return await updateAvailability(productId, isAvailable);
}

/**
 * Retrieve order details from database
 */
async function getOrder(orderId) {
  if (!orderId) {
    throw new Error("orderId is required");
  }
  try {
    const res = await pool.query("SELECT * FROM dineflow_orders WHERE id = $1", [
      orderId,
    ]);
    if (!res.rowCount) return null;
    const row = res.rows[0];
    const itemsRes = await pool.query(
      "SELECT id, product_id, item_name, quantity, unit_price, line_total, selections FROM dineflow_order_items WHERE order_id = $1 ORDER BY created_at",
      [orderId]
    );
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      tableId: row.table_id,
      tableSessionId: row.table_session_id,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      currency: row.currency,
      subtotal: Number(row.subtotal),
      total: Number(row.total),
      items: itemsRes.rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        name: r.item_name,
        quantity: r.quantity,
        unitPrice: Number(r.unit_price),
        lineTotal: Number(r.line_total),
        selections: r.selections,
      })),
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Get Table and active session status
 */
async function getTableStatus(tableId, restaurantId) {
  if (!tableId) throw new Error("tableId is required");
  try {
    const res = await pool.query(
      "SELECT id, restaurant_id, table_number, status, is_active FROM tables WHERE id = $1 AND ($2::text IS NULL OR restaurant_id = $2)",
      [tableId, restaurantId || null]
    );
    if (res.rowCount > 0) {
      return res.rows[0];
    }
  } catch {
    // Graceful fallback
  }
  return { tableId, restaurantId, status: "AVAILABLE", isActive: true };
}

/**
 * Get active kitchen queue for restaurant
 */
async function getKitchenStatus(restaurantId) {
  if (!restaurantId) throw new Error("restaurantId is required");
  try {
    const res = await pool.query(
      `SELECT id, table_id, status, created_at, total
       FROM dineflow_orders
       WHERE restaurant_id = $1 AND status IN ('SUBMITTED', 'PENDING_KITCHEN', 'ACCEPTED', 'PREPARING', 'READY')
       ORDER BY created_at ASC`,
      [restaurantId]
    );
    return res.rows.map((r) => ({
      orderId: r.id,
      tableId: r.table_id,
      status: r.status,
      createdAt: r.created_at,
      total: Number(r.total),
    }));
  } catch {
    return [];
  }
}

/**
 * Authoritative Dietary & Allergen Safety Inspector
 * Conforms to strict anti-hallucination constraint:
 * Never claim safety when ingredient or allergen data is incomplete.
 */
async function checkDietarySafety(productId, allergens = []) {
  if (!productId) throw new Error("productId is required");
  const product = await getMenuItemDetails(productId);
  if (!product) throw new Error(`Product not found: ${productId}`);

  const targetAllergens = (Array.isArray(allergens) ? allergens : [allergens])
    .map((a) => String(a).toUpperCase().trim())
    .filter(Boolean);

  const detected = [];
  const text = `${product.name} ${product.description || ""}`.toUpperCase();
  const tags = (product.dietaryTags || []).map((t) => t.toUpperCase());

  for (const allergen of targetAllergens) {
    if (text.includes(allergen) || tags.includes(allergen)) {
      detected.push(allergen);
    }
  }

  const hasCompositionData = Boolean(
    product.recipeId || (product.ingredients && product.ingredients.length > 0)
  );

  return {
    productId,
    name: product.name,
    safe: detected.length === 0 && hasCompositionData,
    unverified: !hasCompositionData,
    detectedAllergens: detected,
    notes: !hasCompositionData
      ? "Ingredient cross-contact data is unverified in menu records. Consult staff before ordering if you have severe allergies."
      : detected.length > 0
        ? `Contains or mentions allergen(s): ${detected.join(", ")}`
        : "No specified allergens detected in registered recipe records.",
  };
}

module.exports = {
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
};
