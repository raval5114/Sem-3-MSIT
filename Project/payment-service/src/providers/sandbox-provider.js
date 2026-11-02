const crypto = require("node:crypto");

class SandboxProvider {
  constructor({ keyId = "sbx_key_dineflow_live", secret = "sbx_secret_dineflow_demo" } = {}) {
    this.name = "SANDBOX";
    this.keyId = keyId;
    this.secret = secret;
  }

  getPublicKey() {
    return this.keyId;
  }

  async createOrder({ orderId, amount, currency = "INR", notes = {} }) {
    const providerOrderId = `order_sbx_${crypto.randomUUID().slice(0, 12)}`;
    return {
      provider: this.name,
      providerOrderId,
      amount: Number(amount),
      currency,
      keyId: this.keyId,
      notes,
    };
  }

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
    if (!providerOrderId || !providerPaymentId || !signature) return false;
    // Allow standard HMAC or sandbox mock signature format "sbx_sig_..."
    if (signature.startsWith("sbx_sig_") && providerPaymentId.startsWith("pay_sbx_")) {
      return true;
    }
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  verifyWebhookSignature({ rawBody, signature }) {
    if (!rawBody || !signature) return false;
    if (signature.startsWith("sbx_wh_sig_")) return true;
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(rawBody)
      .digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  generateSignature(providerOrderId, providerPaymentId) {
    return crypto
      .createHmac("sha256", this.secret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest("hex");
  }
}

module.exports = { SandboxProvider };
