const test = require("node:test");
const assert = require("node:assert/strict");
const { RazorpayProvider } = require("../src/providers/razorpay-provider");
const { SandboxProvider } = require("../src/providers/sandbox-provider");

test("RazorpayProvider: creates order and verifies valid signature", async () => {
  const provider = new RazorpayProvider({
    keyId: "rzp_test_123",
    keySecret: "secret_xyz",
    webhookSecret: "wh_secret_abc",
  });

  const order = await provider.createOrder({ orderId: "order_1", amount: 250.5 });
  assert.equal(order.provider, "RAZORPAY");
  assert.equal(order.amount, 250.5);
  assert.equal(order.amountInSmallestUnit, 25050); // paisa
  assert.ok(order.providerOrderId.startsWith("order_"));

  const paymentId = "pay_test_999";
  const validSignature = provider.generateSignature(order.providerOrderId, paymentId);

  const isValid = provider.verifyPaymentSignature({
    providerOrderId: order.providerOrderId,
    providerPaymentId: paymentId,
    signature: validSignature,
  });
  assert.equal(isValid, true);

  const isInvalid = provider.verifyPaymentSignature({
    providerOrderId: order.providerOrderId,
    providerPaymentId: paymentId,
    signature: "tampered_signature_hex_value",
  });
  assert.equal(isInvalid, false);
});

test("RazorpayProvider: verifies webhook signature and rejects tampered payload", () => {
  const provider = new RazorpayProvider({ webhookSecret: "wh_secret_abc" });
  const rawBody = JSON.stringify({ event: "payment.captured", id: "evt_1" });
  const crypto = require("node:crypto");
  const signature = crypto.createHmac("sha256", "wh_secret_abc").update(rawBody).digest("hex");

  assert.equal(provider.verifyWebhookSignature({ rawBody, signature }), true);
  assert.equal(provider.verifyWebhookSignature({ rawBody: rawBody + "tamper", signature }), false);
});

test("SandboxProvider: creates mock order and validates signature", async () => {
  const sandbox = new SandboxProvider();
  const order = await sandbox.createOrder({ orderId: "o_1", amount: 100 });
  assert.equal(order.provider, "SANDBOX");
  assert.ok(order.providerOrderId.startsWith("order_sbx_"));

  const sig = sandbox.generateSignature(order.providerOrderId, "pay_123");
  assert.equal(sandbox.verifyPaymentSignature({ providerOrderId: order.providerOrderId, providerPaymentId: "pay_123", signature: sig }), true);
  assert.equal(sandbox.verifyPaymentSignature({ providerOrderId: order.providerOrderId, providerPaymentId: "pay_123", signature: "fake" }), false);
});

