function createCatalogClient({ baseUrl = process.env.MENU_SERVICE_URL || "http://localhost:3001", fetchImpl = fetch } = {}) {
  return {
    async getProductDetails(productId) {
      const response = await fetchImpl(`${baseUrl}/api/v1/menu/products/${encodeURIComponent(productId)}/details`);
      if (response.status === 404) return null;
      if (!response.ok) {
        const error = new Error("Menu service is unavailable"); error.status = 503; error.code = "MENU_SERVICE_UNAVAILABLE"; throw error;
      }
      const body = await response.json();
      return body?.data ?? null;
    },
  };
}

module.exports = { createCatalogClient };
