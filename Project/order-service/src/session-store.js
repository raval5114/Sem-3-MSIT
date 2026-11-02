function createSessionStore(redis) {
  return {
    async isActive(restaurantId, tableId, sessionId) {
      const [activeSession, sessionStatus] = await Promise.all([
        redis.get(`dineflow:restaurant:${restaurantId}:table:${tableId}:active-session`),
        redis.get(`dineflow:table-session:${sessionId}`),
      ]);
      return activeSession === sessionId && sessionStatus === "ACTIVE";
    },
  };
}

module.exports = { createSessionStore };
