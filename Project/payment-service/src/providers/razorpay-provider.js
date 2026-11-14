const crypto = require("node:crypto");

class RazorpayProvider {
  constructor({ keyId = process.env.RAZORPAY_KEY_ID || "", keySecret = process.env.RAZORPAY_KEY_SECRET || "", webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "", fetchImpl = fetch, timeoutMs = 10000 } = {}) {
    this.name = "RAZORPAY";
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  getPublicKey() {
    return this.keyId;
  }

  async createOrder({ orderId, amount, currency = "INR", receipt, notes = {} }) {
    if (!this.keyId || !this.keySecret) {
      const error = new Error("Razorpay is selected but its API credentials are not configured.");
      error.status = 503;
      error.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
      throw error;
    }
    const amountInSmallestUnit = Math.round(Number(amount) * 100);
    let response;
    try {
      response = await this.fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amountInSmallestUnit, currency, receipt: receipt || orderId, notes }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      const error = new Error("Could not connect to the payment gateway. Please try again.");
      error.status = 502;
      error.code = "PAYMENT_GATEWAY_UNAVAILABLE";
      throw error;
    }

    let gatewayOrder = {};
    try { gatewayOrder = await response.json(); } catch { /* handled as a gateway error below */ }
    if (!response.ok || !gatewayOrder.id || Number(gatewayOrder.amount) !== amountInSmallestUnit || gatewayOrder.currency !== currency) {
      const error = new Error(response.status >= 500
        ? "The payment gateway could not start checkout. Please try again."
        : "The payment gateway rejected the checkout request.");
      error.status = 502;
      error.code = "PAYMENT_GATEWAY_ORDER_FAILED";
      throw error;
    }
    return {
      provider: this.name,
      providerOrderId: gatewayOrder.id,
      amount: Number(amount),
      amountInSmallestUnit,
      currency: gatewayOrder.currency,
      receipt: gatewayOrder.receipt || receipt || orderId,
      keyId: this.keyId,
      notes,
    };
  }

  async fetchPayment(providerPaymentId) {
    if (!this.keyId || !this.keySecret || !providerPaymentId) {
      const error = new Error("Razorpay payment details could not be verified.");
      error.status = 503;
      error.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
      throw error;
    }
    let response;
    try {
      response = await this.fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}`, {
        method: "GET",
        headers: { Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      const error = new Error("Could not verify the payment with the gateway. Please try again.");
      error.status = 502;
      error.code = "PAYMENT_GATEWAY_UNAVAILABLE";
      throw error;
    }
    let payment = {};
    try { payment = await response.json(); } catch { /* handled as a gateway error below */ }
    if (!response.ok || !payment.id) {
      const error = new Error("The gateway could not verify this payment.");
      error.status = 502;
      error.code = "PAYMENT_GATEWAY_VERIFICATION_FAILED";
      throw error;
    }
    return payment;
  }

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
    if (!this.keySecret || !providerOrderId || !providerPaymentId || !signature) {
      return false;
    }
    const payload = `${providerOrderId}|${providerPaymentId}`;
    const expected = crypto
      .createHmac("sha256", this.keySecret)
      .update(payload)
      .digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  verifyWebhookSignature({ rawBody, signature }) {
    if (!this.webhookSecret || !rawBody || !signature) return false;
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  // Generates a valid test signature for sandbox verification
  generateSignature(providerOrderId, providerPaymentId) {
    const payload = `${providerOrderId}|${providerPaymentId}`;
    return crypto
      .createHmac("sha256", this.keySecret)
      .update(payload)
      .digest("hex");
  }
}

module.exports = { RazorpayProvider };
