const crypto = require("node:crypto");

class CheckoutError extends Error {
  constructor(message, status = 400, code = "CHECKOUT_INVALID") {
    super(message); this.status = status; this.code = code;
  }
}

const cents = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new CheckoutError("Menu price is invalid", 502, "MENU_PRICE_INVALID");
  return Math.round((amount + Number.EPSILON) * 100);
};

function selectOptions(product, request) {
  const variantSelections = request.variantSelections ?? [];
  const modifierSelections = request.modifierSelections ?? [];
  if (!Array.isArray(variantSelections) || !Array.isArray(modifierSelections)) throw new CheckoutError("Selections must be arrays");
  let unitCents = cents(product.basePrice);
  const selected = [];
  const usedVariants = new Set();
  for (const selection of variantSelections) {
    if (!selection || typeof selection !== "object") throw new CheckoutError("Variant selection is invalid");
    if (usedVariants.has(selection.variantId)) throw new CheckoutError("A variant can only be selected once");
    usedVariants.add(selection.variantId);
    const variant = (product.variants || []).find((entry) => entry._id === selection.variantId && entry.isActive);
    const option = variant?.options?.find((entry) => entry.optionId === selection.optionId && entry.isAvailable !== false);
    if (!variant || !option) throw new CheckoutError("Selected variant option is unavailable", 409, "MENU_SELECTION_STALE");
    unitCents += cents(option.priceAdjustment || 0);
    selected.push({ type: "VARIANT", groupId: variant._id, groupName: variant.name, optionId: option.optionId, optionName: option.name, priceAdjustment: cents(option.priceAdjustment || 0) / 100 });
  }

  const usedGroups = new Set();
  for (const selection of modifierSelections) {
    if (!selection || typeof selection !== "object") throw new CheckoutError("Modifier selection is invalid");
    if (usedGroups.has(selection.groupId)) throw new CheckoutError("A modifier group can only be selected once");
    usedGroups.add(selection.groupId);
    const group = (product.modifierGroups || []).find((entry) => entry._id === selection.groupId && entry.isActive);
    if (!group || !Array.isArray(selection.optionIds)) throw new CheckoutError("Selected modifier group is unavailable", 409, "MENU_SELECTION_STALE");
    const uniqueIds = new Set(selection.optionIds);
    if (uniqueIds.size !== selection.optionIds.length) throw new CheckoutError("Duplicate modifier options are not allowed");
    const min = group.required ? Math.max(1, group.minimumSelection || 0) : (group.minimumSelection || 0);
    if (uniqueIds.size < min) throw new CheckoutError(`Choose at least ${min} option${min === 1 ? '' : 's'} for ${group.name}`);
    if (uniqueIds.size > group.maximumSelection) throw new CheckoutError(`Choose no more than ${group.maximumSelection} options for ${group.name}`);
    for (const optionId of uniqueIds) {
      const option = group.options.find((entry) => entry.optionId === optionId && entry.isAvailable !== false);
      if (!option) throw new CheckoutError("Selected modifier option is unavailable", 409, "MENU_SELECTION_STALE");
      unitCents += cents(option.priceAdjustment || 0);
      selected.push({ type: "MODIFIER", groupId: group._id, groupName: group.name, optionId: option.optionId, optionName: option.name, priceAdjustment: cents(option.priceAdjustment || 0) / 100 });
    }
  }
  for (const group of product.modifierGroups || []) {
    const minimum = group.required ? Math.max(1, group.minimumSelection || 0) : (group.minimumSelection || 0);
    const selectedCount = (modifierSelections.find((selection) => selection.groupId === group._id)?.optionIds || []).length;
    if (group.isActive && selectedCount < minimum) throw new CheckoutError(`Choose at least ${minimum} option${minimum === 1 ? '' : 's'} for ${group.name}`);
  }
  return { unitCents, selected };
}

function validateOrderRequest(body) {
  if (body.paymentMethod !== "PAY_AT_COUNTER" && body.paymentMethod !== "ONLINE") {
    throw new CheckoutError("Payment method must be PAY_AT_COUNTER or ONLINE", 422, "INVALID_PAYMENT_METHOD");
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) throw new CheckoutError("Order must contain between 1 and 30 item lines");
  for (const item of body.items) {
    if (!item || typeof item !== "object") throw new CheckoutError("Each order line must be an object");
    if (typeof item.productId !== "string" || !item.productId.trim()) throw new CheckoutError("Each order line needs a productId");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new CheckoutError("Quantity must be a whole number between 1 and 99");
  }
}

function createCheckoutService({ catalog, repository, sessionStore, redisPublisher = null, idFactory = crypto.randomUUID }) {
  return {
    async placeOrder(claims, body) {
      if (claims.type !== "CUSTOMER" || !claims.sub || !claims.restaurantId || !claims.tableId || !claims.tableSessionId || !claims.privileges?.includes("ORDER_CREATE")) {
        throw new CheckoutError("A customer table-session token is required", 403, "CUSTOMER_TOKEN_REQUIRED");
      }
      validateOrderRequest(body);
      const sessionActive = await sessionStore.isActive(claims.restaurantId, claims.tableId, claims.tableSessionId);
      if (!sessionActive) throw new CheckoutError("This table session is closed or expired", 410, "TABLE_SESSION_INACTIVE");

      const lines = [];
      let subtotalCents = 0;
      for (const requested of body.items) {
        const product = await catalog.getProductDetails(requested.productId);
        if (!product || product.restaurantId !== claims.restaurantId || product.status !== "ACTIVE" || product.isAvailable !== true || product.category?.isActive !== true) {
          throw new CheckoutError("One or more menu items are unavailable", 409, "MENU_ITEM_UNAVAILABLE");
        }
        const { unitCents, selected } = selectOptions(product, requested);
        const lineCents = unitCents * requested.quantity;
        subtotalCents += lineCents;
        lines.push({
          productId: product._id,
          name: product.name,
          quantity: requested.quantity,
          selections: selected,
          unitPrice: unitCents / 100,
          lineTotal: lineCents / 100,
        });
      }
      const isOnline = body.paymentMethod === "ONLINE";
      const order = {
        id: idFactory(),
        restaurantId: claims.restaurantId,
        tableId: claims.tableId,
        tableSessionId: claims.tableSessionId,
        customerId: claims.sub,
        status: isOnline ? "PAYMENT_PENDING" : "SUBMITTED",
        paymentMethod: body.paymentMethod,
        paymentStatus: isOnline ? "PENDING" : "UNPAID",
        currency: "INR",
        subtotal: subtotalCents / 100,
        total: subtotalCents / 100,
        items: lines,
      };
      const created = await repository.create(order);
      if (redisPublisher && typeof redisPublisher.publish === "function") {
        try {
          await redisPublisher.publish(
            "order_events",
            JSON.stringify({
              event: "ORDER_CREATED",
              orderId: created.id,
              restaurantId: created.restaurantId,
              tableId: created.tableId,
              tableSessionId: created.tableSessionId,
              status: created.status,
              total: created.total,
              items: created.items,
              createdAt: created.createdAt,
            })
          );
        } catch {
          // Non-blocking publish error
        }
      }
      return created;
    },
  };
}

module.exports = { CheckoutError, cents, selectOptions, validateOrderRequest, createCheckoutService };
