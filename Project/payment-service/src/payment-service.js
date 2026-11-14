const crypto = require("node:crypto");

class PaymentError extends Error {
  constructor(message, status = 400, code = "PAYMENT_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function createPaymentService({ provider, repository, sessionStore, redisPublisher, idFactory = crypto.randomUUID }) {
  const normalizePaymentMethod = (method) => ({
    upi: "UPI",
    card: "CARD",
    netbanking: "NETBANKING",
    wallet: "WALLET",
    emi: "EMI",
    paylater: "PAY_LATER",
  }[String(method || "").toLowerCase()] || "ONLINE");

  return {
    async createIntent(claims, { orderId }) {
      if (!claims || !claims.restaurantId) {
        throw new PaymentError("Authentication required", 401, "AUTH_REQUIRED");
      }
      if (claims.type === "CUSTOMER") {
        if (!claims.tableSessionId || !claims.privileges?.includes("ORDER_CREATE")) {
          throw new PaymentError("Customer table session token required", 403, "CUSTOMER_TOKEN_REQUIRED");
        }
        const sessionActive = await sessionStore.isActive(claims.restaurantId, claims.tableId, claims.tableSessionId);
        if (!sessionActive) {
          throw new PaymentError("This table session is closed or expired", 410, "TABLE_SESSION_INACTIVE");
        }
      }

      if (!orderId) {
        throw new PaymentError("orderId is required", 400, "ORDER_ID_REQUIRED");
      }

      const order = await repository.findOrder(orderId);
      if (!order || order.restaurantId !== claims.restaurantId) {
        throw new PaymentError("Order not found for this restaurant", 404, "ORDER_NOT_FOUND");
      }

      if (claims.type === "CUSTOMER" && order.tableSessionId !== claims.tableSessionId) {
        throw new PaymentError("Order does not belong to your table session", 403, "CROSS_SESSION_FORBIDDEN");
      }

      if (order.paymentStatus === "PAID") {
        throw new PaymentError("This order has already been paid", 409, "ORDER_ALREADY_PAID");
      }

      // Check for existing pending payment to provide idempotency
      const existing = await repository.findPendingPaymentForOrder(orderId);
      if (existing && existing.providerOrderId) {
        return {
          paymentId: existing.id,
          provider: existing.provider,
          orderId: order.id,
          amount: existing.amount,
          currency: existing.currency,
          providerOrderId: existing.providerOrderId,
          keyId: provider.getPublicKey(),
        };
      }

      const providerOrder = await provider.createOrder({
        orderId: order.id,
        amount: order.total,
        currency: order.currency,
        notes: {
          restaurantId: claims.restaurantId,
          tableId: order.tableId,
          tableSessionId: order.tableSessionId,
        },
      });

      const paymentRecord = await repository.createPayment({
        id: idFactory(),
        orderId: order.id,
        restaurantId: claims.restaurantId,
        tableId: order.tableId,
        tableSessionId: order.tableSessionId,
        customerId: claims.sub,
        amount: order.total,
        currency: order.currency,
        provider: provider.name,
        providerOrderId: providerOrder.providerOrderId,
        status: "PENDING",
        paymentMethod: "ONLINE",
        metadata: { client: claims.type },
      });

      return {
        paymentId: paymentRecord.id,
        provider: paymentRecord.provider,
        orderId: order.id,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        providerOrderId: paymentRecord.providerOrderId,
        keyId: provider.getPublicKey(),
      };
    },

    async verifyPayment(claims, { orderId, paymentId, providerPaymentId, providerOrderId, signature }) {
      if (!orderId || !signature) {
        throw new PaymentError("orderId and signature are required", 400, "MISSING_VERIFICATION_DATA");
      }

      let payment = null;
      if (paymentId) {
        payment = await repository.findPaymentById(paymentId);
      } else if (providerOrderId) {
        payment = await repository.findPaymentByProviderOrderId(providerOrderId);
      } else {
        const payments = await repository.findPaymentsForOrder(orderId);
        payment = payments[0] || null;
      }

      if (!payment) {
        throw new PaymentError("Payment intent record not found for this order", 404, "PAYMENT_NOT_FOUND");
      }
      if (payment.restaurantId !== claims.restaurantId) {
        throw new PaymentError("Payment record not found for this restaurant", 404, "PAYMENT_NOT_FOUND");
      }
      if (payment.orderId !== orderId) {
        throw new PaymentError("Payment record not found for this order", 404, "PAYMENT_NOT_FOUND");
      }
      if (claims.type === "CUSTOMER" &&
          (!claims.tableSessionId || payment.tableSessionId !== claims.tableSessionId)) {
        throw new PaymentError("Payment does not belong to your table session", 403, "CROSS_SESSION_FORBIDDEN");
      }

      if (payment.status === "CAPTURED") {
        return {
          paymentId: payment.id,
          orderId: payment.orderId,
          status: "PAID",
          orderStatus: "PENDING_KITCHEN",
          alreadyCaptured: true,
        };
      }
      if (payment.status !== "PENDING") {
        throw new PaymentError("This payment intent is no longer pending", 409, "PAYMENT_NOT_PENDING");
      }

      const validSignature = provider.verifyPaymentSignature({
        providerOrderId: payment.providerOrderId || providerOrderId,
        providerPaymentId,
        signature,
      });

      if (!validSignature) {
        await repository.markPaymentFailed(payment.id, "Invalid cryptographic signature");
        throw new PaymentError("Payment signature verification failed", 400, "PAYMENT_VERIFICATION_FAILED");
      }

      let gatewayPayment = null;
      if (typeof provider.fetchPayment === "function") {
        gatewayPayment = await provider.fetchPayment(providerPaymentId);
        if (gatewayPayment.order_id !== payment.providerOrderId
            || Number(gatewayPayment.amount) !== Math.round(payment.amount * 100)
            || gatewayPayment.currency !== payment.currency) {
          throw new PaymentError("The gateway payment does not match this order.", 409, "PAYMENT_DETAILS_MISMATCH");
        }
        if (gatewayPayment.status !== "captured") {
          throw new PaymentError("Payment has not been captured yet. Please wait or try another method.", 409, "PAYMENT_NOT_CAPTURED");
        }
      }

      const result = await repository.capturePaymentAndReleaseOrder({
        paymentId: payment.id,
        orderId: payment.orderId,
        restaurantId: payment.restaurantId,
        providerPaymentId: providerPaymentId || `pay_${crypto.randomUUID()}`,
        paymentMethod: gatewayPayment ? normalizePaymentMethod(gatewayPayment.method) : undefined,
        metadata: {
          verifiedAt: new Date().toISOString(),
          ...(gatewayPayment ? { gatewayMethod: gatewayPayment.method } : {}),
        },
      });

      if (redisPublisher && typeof redisPublisher.publish === "function") {
        try {
          await redisPublisher.publish(
            "order_events",
            JSON.stringify({
              event: "ORDER_PAID",
              orderId: payment.orderId,
              restaurantId: payment.restaurantId,
              tableId: payment.tableId,
              tableSessionId: payment.tableSessionId,
              amount: payment.amount,
            })
          );
        } catch {
          // Non-blocking publish error
        }
      }

      return {
        paymentId: result.payment.id,
        orderId: result.payment.orderId,
        status: "PAID",
        orderStatus: "PENDING_KITCHEN",
      };
    },

    async recordCashPayment(claims, { orderId, idempotencyKey }) {
      if (claims?.type !== "STAFF" || !claims.restaurantId || !claims.sub
          || !claims.roles?.some((role) => ["CASHIER", "RESTAURANT_ADMIN"].includes(role))) {
        throw new PaymentError("An authenticated cashier session is required", 403, "STAFF_TOKEN_REQUIRED");
      }
      if (!claims.privileges?.includes("PAYMENT_PROCESS")) {
        throw new PaymentError("Cashier payment permission is required", 403, "PERMISSION_DENIED");
      }
      if (!orderId || !idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length > 100) {
        throw new PaymentError("orderId and a valid idempotencyKey are required", 400, "MISSING_PAYMENT_DATA");
      }
      const result = await repository.captureCashPayment({
        orderId,
        restaurantId: claims.restaurantId,
        cashierId: claims.sub,
        idempotencyKey,
      });
      if (redisPublisher && typeof redisPublisher.publish === "function" && !result.alreadyRecorded) {
        try {
          await redisPublisher.publish("order_events", JSON.stringify({
            event: "ORDER_PAID",
            orderId,
            restaurantId: claims.restaurantId,
            tableId: result.order.tableId,
            tableSessionId: result.order.tableSessionId,
            amount: result.payment.amount,
            paymentMethod: "CASH",
          }));
        } catch {
          // Persisted payment state remains authoritative if event publication fails.
        }
      }
      return {
        paymentId: result.payment.id,
        orderId,
        status: "PAID",
        orderStatus: result.order.status,
        paymentMethod: "CASH",
        alreadyRecorded: result.alreadyRecorded,
      };
    },

    async handleWebhook({ rawBody, signature, payload }) {
      const valid = provider.verifyWebhookSignature({ rawBody, signature });
      if (!valid) {
        throw new PaymentError("Webhook signature verification failed", 401, "WEBHOOK_VERIFICATION_FAILED");
      }

      const event = payload?.event || payload?.type;
      const paymentData = payload?.payload?.payment?.entity || payload?.data?.object || payload;
      const providerOrderId = paymentData?.order_id || paymentData?.orderId || payload?.providerOrderId;

      if (!providerOrderId && !paymentData?.id) {
        return { received: true, processed: false, reason: "No identifier found" };
      }

      if (event === "payment.captured" || event === "order.paid" || event === "charge.successful") {
        const payment = await repository.findPaymentByProviderOrderId(providerOrderId);
        if (payment && payment.status !== "CAPTURED") {
          await repository.capturePaymentAndReleaseOrder({
            paymentId: payment.id,
            orderId: payment.orderId,
            restaurantId: payment.restaurantId,
            providerPaymentId: paymentData.id || `wh_${crypto.randomUUID()}`,
            paymentMethod: normalizePaymentMethod(paymentData.method),
            metadata: { webhookEvent: event },
          });
        }
      } else if (event === "payment.failed") {
        const payment = await repository.findPaymentByProviderOrderId(providerOrderId);
        if (payment && payment.status === "PENDING") {
          await repository.markPaymentFailed(payment.id, paymentData.error_description || "Webhook payment failed");
        }
      } else if (event === "refund.processed") {
        const payment = await repository.findPaymentByProviderOrderId(providerOrderId);
        if (payment && payment.status === "CAPTURED") {
          await repository.markPaymentRefunded({
            paymentId: payment.id,
            orderId: payment.orderId,
            refundAmount: Number(paymentData.amount ? paymentData.amount / 100 : payment.amount),
            reason: paymentData.reason || "Customer refund",
          });
        }
      }

      return { received: true, processed: true, event };
    },

    async getPaymentByOrderId(claims, orderId) {
      if (!claims || !claims.restaurantId) throw new PaymentError("Auth required", 401);
      const payments = await repository.findPaymentsForOrder(orderId);
      if (!payments.length) throw new PaymentError("No payments found for this order", 404, "NOT_FOUND");
      if (payments[0].restaurantId !== claims.restaurantId) {
        throw new PaymentError("Not authorized to view payments for another restaurant", 403, "FORBIDDEN");
      }
      if (claims.type === "CUSTOMER" &&
          (!claims.tableSessionId || payments.some((payment) => payment.tableSessionId !== claims.tableSessionId))) {
        throw new PaymentError("Payment does not belong to your table session", 403, "CROSS_SESSION_FORBIDDEN");
      }
      return payments;
    },

    async refundPayment(claims, { orderId, paymentId, amount, reason }) {
      if (!claims.privileges?.includes("PAYMENT_REFUND")) {
        throw new PaymentError("Insufficient privileges to refund payment", 403, "PERMISSION_DENIED");
      }
      const payment = await repository.findPaymentById(paymentId);
      if (!payment || payment.restaurantId !== claims.restaurantId) {
        throw new PaymentError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
      }
      if (payment.status !== "CAPTURED") {
        throw new PaymentError("Only captured payments can be refunded", 400, "CANNOT_REFUND");
      }
      return repository.markPaymentRefunded({
        paymentId: payment.id,
        orderId: payment.orderId,
        refundAmount: amount || payment.amount,
        reason: reason || "Staff initiated refund",
      });
    },
  };
}

module.exports = { PaymentError, createPaymentService };
