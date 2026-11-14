const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || "http://localhost:8081").replace(/\/+$/, "");

function requireMenuAccess({ fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  return async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "A staff bearer token is required",
      });
    }

    const permission = req.method === "GET"
      ? "MENU_READ"
      : req.method === "POST"
        ? "MENU_CREATE"
        : req.method === "PATCH" && req.path.endsWith("/availability")
          ? "MENU_TOGGLE_AVAIL"
          : "MENU_UPDATE";

    let response;
    try {
      response = await fetchImpl(`${AUTH_SERVICE_URL}/auth/access/authorize`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ featureKey: "MENU_MANAGEMENT", permission }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        code: "ACCESS_POLICY_UNAVAILABLE",
        message: "Authorization service is temporarily unavailable",
      });
    }

    let result = {};
    try {
      result = await response.json();
    } catch (error) {
      if (response.status !== 401 && response.status !== 403) {
        return res.status(503).json({
          success: false,
          code: "ACCESS_POLICY_UNAVAILABLE",
          message: "Authorization service returned an invalid response",
        });
      }
    }
    if (!response.ok || !result.allowed) {
      const status = response.status === 401 || response.status === 403 ? response.status : 503;
      return res.status(status).json({
        success: false,
        code: result.code || (status === 401 ? "TOKEN_INVALID" : status === 503 ? "ACCESS_POLICY_UNAVAILABLE" : "ACCESS_DENIED"),
        message: status === 503
          ? "Authorization service is temporarily unavailable"
          : result.message || "Access denied",
      });
    }
    const restaurantId = result.context?.restaurantId;
    if (!restaurantId) {
      return res.status(403).json({
        success: false,
        code: "RESTAURANT_SCOPE_REQUIRED",
        message: "Restaurant-scoped staff access is required",
      });
    }
    const requestedRestaurantId = req.body?.restaurantId || req.query?.restaurantId;
    if (requestedRestaurantId && requestedRestaurantId !== restaurantId) {
      return res.status(403).json({
        success: false,
        code: "CROSS_TENANT_FORBIDDEN",
        message: "The requested restaurant does not match the authenticated membership",
      });
    }
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      req.body.restaurantId = restaurantId;
    }
    req.accessContext = result.context;
    return next();
  };
}

module.exports = { requireMenuAccess };
