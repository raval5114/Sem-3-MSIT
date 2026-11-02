const crypto = require("node:crypto");

class RazorpayProvider {
  constructor({ keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_dineflow", keySecret = process.env.RAZORPAY_KEY_SECRET || "dineflow_secret_key_123", webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "dineflow_wh_secret_456" } = {}) {
    this.name = "RAZORPAY";
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  getPublicKey() {
    return this.keyId;
  }

  async createOrder({ orderId, amount, currency = "INR", receipt, notes = {} }) {
    // Amount in paisa (smallest currency unit for INR)
    const amountInSmallestUnit = Math.round(Number(amount) * 100);
    const providerOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    return {
      provider: this.name,
      providerOrderId,
      amount: Number(amount),
      amountInSmallestUnit,
      currency,
      receipt: receipt || orderId,
      keyId: this.keyId,
      notes,
    };
  }

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
    if (!providerOrderId || !providerPaymentId || !signature) {
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
    if (!rawBody || !signature) return false;
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
