const { RazorpayProvider } = require("./razorpay-provider");
const { SandboxProvider } = require("./sandbox-provider");

function getPaymentProvider(config = process.env) {
  const providerType = (config.PAYMENT_PROVIDER || "sandbox").toLowerCase();
  if (providerType === "razorpay") {
    return new RazorpayProvider({
      keyId: config.RAZORPAY_KEY_ID,
      keySecret: config.RAZORPAY_KEY_SECRET,
      webhookSecret: config.RAZORPAY_WEBHOOK_SECRET,
    });
  }
  return new SandboxProvider({
    keyId: config.SANDBOX_KEY_ID,
    secret: config.SANDBOX_SECRET,
  });
}

module.exports = { getPaymentProvider };

