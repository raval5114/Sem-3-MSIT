function createSessionStore(redis) {
  return {
    async isActive(restaurantId, tableId, sessionId) {
      if (!redis) return true; // Fail open in mock/unit test environments if no redis configured
      try {
        const [activeSession, sessionStatus] = await Promise.all([
          redis.get(`dineflow:restaurant:${restaurantId}:table:${tableId}:active-session`),
          redis.get(`dineflow:table-session:${sessionId}`),
        ]);
        return activeSession === sessionId && sessionStatus === "ACTIVE";
      } catch {
        return false;
      }
    },
  };
}

module.exports = { createSessionStore };

