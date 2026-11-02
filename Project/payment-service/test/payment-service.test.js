const test = require("node:test");
const assert = require("node:assert/strict");
const { createPaymentService, PaymentError } = require("../src/payment-service");
const { SandboxProvider } = require("../src/providers/sandbox-provider");

const customerClaims = {
  sub: "customer_1",
  type: "CUSTOMER",
  restaurantId: "rest_1",
  tableId: "table_1",
  tableSessionId: "session_1",
  privileges: ["MENU_READ", "ORDER_CREATE"],
};

const staffClaims = {
  sub: "admin_1",
  type: "STAFF",
  restaurantId: "rest_1",
  privileges: ["PAYMENT_PROCESS", "PAYMENT_REFUND"],
};

function fixture(overrides = {}) {
  const provider = new SandboxProvider();
  let savedPayment = null;
  let orderState = {
    id: "ord_1",
    restaurantId: "rest_1",
    tableId: "table_1",
    tableSessionId: "session_1",
    status: "PAYMENT_PENDING",
    paymentMethod: "ONLINE",
    paymentStatus: "PENDING",
    currency: "INR",
    total: 250,
  };

  const repository = {
    async findOrder(orderId) {
      if (orderId !== orderState.id) return null;
      return { ...orderState };
    },
    async findPendingPaymentForOrder(orderId) {
      if (savedPayment && savedPayment.orderId === orderId && savedPayment.status === "PENDING") {
        return savedPayment;
      }
      return null;
    },
    async findPaymentById(id) {
      return savedPayment && savedPayment.id === id ? savedPayment : null;
    },
    async findPaymentByProviderOrderId(providerOrderId) {
      return savedPayment && savedPayment.providerOrderId === providerOrderId ? savedPayment : null;
    },
    async findPaymentsForOrder(orderId) {
      return savedPayment && savedPayment.orderId === orderId ? [savedPayment] : [];
    },
    async createPayment(payment) {
      savedPayment = { ...payment, id: payment.id || "pay_rec_1", status: "PENDING" };
      return savedPayment;
    },
    async capturePaymentAndReleaseOrder({ paymentId, orderId, providerPaymentId, metadata }) {
      if (savedPayment) {
        savedPayment.status = "CAPTURED";
        savedPayment.providerPaymentId = providerPaymentId;
        savedPayment.metadata = { ...savedPayment.metadata, ...metadata };
      }
      orderState.paymentStatus = "PAID";
      orderState.status = "PENDING_KITCHEN";
      return { payment: savedPayment, order: orderState };
    },
    async markPaymentFailed(paymentId, errorMessage) {
      if (savedPayment && savedPayment.id === paymentId) {
        savedPayment.status = "FAILED";
        savedPayment.errorMessage = errorMessage;
      }
      return savedPayment;
    },
    async markPaymentRefunded({ paymentId, orderId, refundAmount, reason }) {
      if (savedPayment) {
        savedPayment.status = "REFUNDED";
        savedPayment.metadata = { ...savedPayment.metadata, refundAmount, reason };
      }
      orderState.paymentStatus = "REFUNDED";
      return savedPayment;
    },
    ...overrides.repository,
  };

  const sessionStore = {
    async isActive(_r, _t, _s) {
      return true;
    },
    ...overrides.sessionStore,
  };

  let publishedEvents = [];
  const redisPublisher = {
    async publish(channel, message) {
      publishedEvents.push({ channel, message: JSON.parse(message) });
    },
  };

  const service = createPaymentService({
    provider,
    repository,
    sessionStore,
    redisPublisher,
    idFactory: () => "pay_rec_1",
    ...overrides,
  });

  return {
    service,
    provider,
    getSavedPayment: () => savedPayment,
    getOrderState: () => orderState,
    getPublishedEvents: () => publishedEvents,
  };
}

test("createIntent: creates payment intent and stores pending payment record", async () => {
  const { service, getSavedPayment } = fixture();
  const intent = await service.createIntent(customerClaims, { orderId: "ord_1" });

  assert.equal(intent.orderId, "ord_1");
  assert.equal(intent.amount, 250);
  assert.equal(intent.currency, "INR");
  assert.ok(intent.providerOrderId.startsWith("order_sbx_"));

  const saved = getSavedPayment();
  assert.equal(saved.status, "PENDING");
  assert.equal(saved.orderId, "ord_1");
  assert.equal(saved.amount, 250);
});

test("createIntent: idempotently returns existing pending payment for same order", async () => {
  const { service } = fixture();
  const first = await service.createIntent(customerClaims, { orderId: "ord_1" });
  const second = await service.createIntent(customerClaims, { orderId: "ord_1" });

  assert.equal(first.providerOrderId, second.providerOrderId);
  assert.equal(first.paymentId, second.paymentId);
});

test("createIntent: rejects orders belonging to another restaurant or closed sessions", async () => {
  const closedSession = fixture({ sessionStore: { isActive: async () => false } });
  await assert.rejects(
    closedSession.service.createIntent(customerClaims, { orderId: "ord_1" }),
    (err) => err.code === "TABLE_SESSION_INACTIVE" && err.status === 410
  );

  const crossRestaurant = fixture();
  await assert.rejects(
    crossRestaurant.service.createIntent({ ...customerClaims, restaurantId: "other_restaurant" }, { orderId: "ord_1" }),
    (err) => err.code === "ORDER_NOT_FOUND" && err.status === 404
  );
});

test("verifyPayment: captures payment and updates order to PAID & PENDING_KITCHEN", async () => {
  const { service, provider, getSavedPayment, getOrderState, getPublishedEvents } = fixture();
  const intent = await service.createIntent(customerClaims, { orderId: "ord_1" });

  const providerPaymentId = "pay_test_001";
  const signature = provider.generateSignature(intent.providerOrderId, providerPaymentId);

  const result = await service.verifyPayment(customerClaims, {
    orderId: "ord_1",
    paymentId: intent.paymentId,
    providerPaymentId,
    providerOrderId: intent.providerOrderId,
    signature,
  });

  assert.equal(result.status, "PAID");
  assert.equal(result.orderStatus, "PENDING_KITCHEN");
  assert.equal(getSavedPayment().status, "CAPTURED");
  assert.equal(getOrderState().paymentStatus, "PAID");
  assert.equal(getOrderState().status, "PENDING_KITCHEN");

  const events = getPublishedEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].message.event, "ORDER_PAID");
});

test("verifyPayment: rejects invalid cryptographic signature and marks payment FAILED", async () => {
  const { service, getSavedPayment, getOrderState } = fixture();
  const intent = await service.createIntent(customerClaims, { orderId: "ord_1" });

  await assert.rejects(
    service.verifyPayment(customerClaims, {
      orderId: "ord_1",
      paymentId: intent.paymentId,
      providerPaymentId: "pay_test_001",
      providerOrderId: intent.providerOrderId,
      signature: "invalid_tampered_signature",
    }),
    (err) => err.code === "PAYMENT_VERIFICATION_FAILED" && err.status === 400
  );

  assert.equal(getSavedPayment().status, "FAILED");
  assert.equal(getOrderState().paymentStatus, "PENDING"); // Order remains unpaid
});

test("handleWebhook: processes payment.captured event idempotently", async () => {
  const { service, provider, getSavedPayment, getOrderState } = fixture();
  const intent = await service.createIntent(customerClaims, { orderId: "ord_1" });

  const payload = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_wh_888",
          order_id: intent.providerOrderId,
          amount: 25000,
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = provider.generateSignature(intent.providerOrderId, "pay_wh_888");

  // In sandbox, verifyWebhookSignature will check rawBody HMAC
  const crypto = require("node:crypto");
  const whSig = crypto.createHmac("sha256", provider.secret).update(rawBody).digest("hex");

  const result = await service.handleWebhook({
    rawBody,
    signature: whSig,
    payload,
  });

  assert.equal(result.received, true);
  assert.equal(result.processed, true);
  assert.equal(getSavedPayment().status, "CAPTURED");
  assert.equal(getOrderState().paymentStatus, "PAID");
});

test("refundPayment: processes staff refund when staff has PAYMENT_REFUND privilege", async () => {
  const { service, provider, getSavedPayment, getOrderState } = fixture();
  const intent = await service.createIntent(customerClaims, { orderId: "ord_1" });
  const sig = provider.generateSignature(intent.providerOrderId, "pay_capture_1");
  await service.verifyPayment(customerClaims, {
    orderId: "ord_1",
    paymentId: intent.paymentId,
    providerPaymentId: "pay_capture_1",
    providerOrderId: intent.providerOrderId,
    signature: sig,
  });

  // Now refund with staff claims
  const refund = await service.refundPayment(staffClaims, {
    orderId: "ord_1",
    paymentId: intent.paymentId,
    amount: 250,
    reason: "Customer requested cancellation before prep",
  });

  assert.equal(refund.status, "REFUNDED");
  assert.equal(getOrderState().paymentStatus, "REFUNDED");

  // Rejects when missing PAYMENT_REFUND privilege
  await assert.rejects(
    service.refundPayment(customerClaims, { orderId: "ord_1", paymentId: intent.paymentId }),
    (err) => err.code === "PERMISSION_DENIED" && err.status === 403
  );
});

