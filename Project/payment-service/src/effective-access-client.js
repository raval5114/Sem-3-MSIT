class EffectiveAccessError extends Error {
  constructor(message, status = 503, code = "ACCESS_POLICY_UNAVAILABLE") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class EffectiveAccessClient {
  constructor({
    baseUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8081",
    fetchImpl = fetch,
    timeoutMs = 3000,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async authorize({ token, featureKey, permission, restaurantId }) {
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}/auth/access/authorize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ featureKey, permission, restaurantId }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new EffectiveAccessError("Authorization service is unavailable");
    }

    let result = {};
    try {
      result = await response.json();
    } catch {
      if (response.status !== 401 && response.status !== 403) {
        throw new EffectiveAccessError("Authorization service returned an invalid response");
      }
    }
    if (response.status === 401) {
      throw new EffectiveAccessError(
        result.message || "Authentication is required",
        401,
        result.code || "TOKEN_INVALID"
      );
    }
    if (response.status === 403) {
      throw new EffectiveAccessError(
        result.message || "Access denied",
        403,
        result.code || "ACCESS_DENIED"
      );
    }
    if (!response.ok || !result.allowed || !result.context) {
      throw new EffectiveAccessError(
        "Authorization service is unavailable",
        503,
        "ACCESS_POLICY_UNAVAILABLE"
      );
    }
    return result.context;
  }
}

module.exports = { EffectiveAccessClient, EffectiveAccessError };
