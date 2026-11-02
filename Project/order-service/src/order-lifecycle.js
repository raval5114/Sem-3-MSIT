class OrderLifecycleError extends Error {
  constructor(message, status = 400, code = "INVALID_ORDER_TRANSITION") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const VALID_TRANSITIONS = {
  SUBMITTED: ["ACCEPTED", "CANCELLED"],
  PAYMENT_PENDING: ["PENDING_KITCHEN", "CANCELLED"],
  PENDING_KITCHEN: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function validateTransition(currentStatus, targetStatus, claims = {}) {
  if (!currentStatus || !VALID_TRANSITIONS[currentStatus]) {
    throw new OrderLifecycleError(`Unknown current order status: ${currentStatus}`, 400);
  }

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed.includes(targetStatus)) {
    throw new OrderLifecycleError(
      `Cannot transition order from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowed.join(", ") || "none"}`,
      409,
      "INVALID_ORDER_TRANSITION"
    );
  }

  // Privilege checks based on project.auth.md
  if (targetStatus === "CANCELLED") {
    if (!claims.privileges?.includes("ORDER_CANCEL") && !claims.roles?.includes("SUPER_ADMIN")) {
      throw new OrderLifecycleError("Cancellation requires ORDER_CANCEL privilege", 403, "PERMISSION_DENIED");
    }
  } else {
    if (!claims.privileges?.includes("ORDER_UPDATE_STATUS") && !claims.roles?.includes("SUPER_ADMIN")) {
      throw new OrderLifecycleError("Updating order status requires ORDER_UPDATE_STATUS privilege", 403, "PERMISSION_DENIED");
    }
  }

  return true;
}

module.exports = {
  OrderLifecycleError,
  VALID_TRANSITIONS,
  validateTransition,
};

