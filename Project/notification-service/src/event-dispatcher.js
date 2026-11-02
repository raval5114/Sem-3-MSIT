function createEventDispatcher(io) {
  return {
    dispatch(rawMessage) {
      let data;
      try {
        data = typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage;
      } catch (err) {
        console.error("[Notification Service] Failed to parse Redis message:", err.message);
        return false;
      }

      if (!data || !data.event) return false;

      const { event, restaurantId, tableSessionId, orderId } = data;

      // Broadcast to kitchen staff room
      if (restaurantId) {
        io.to(`kitchen:${restaurantId}`).emit("kitchen_event", data);
        if (event === "ORDER_CREATED") {
          io.to(`kitchen:${restaurantId}`).emit("kitchen_new_order", data);
        } else if (event === "ORDER_STATUS_CHANGED") {
          io.to(`kitchen:${restaurantId}`).emit("kitchen_order_updated", data);
        } else if (event === "ORDER_PAID") {
          io.to(`kitchen:${restaurantId}`).emit("kitchen_order_paid", data);
        }
      }

      // Broadcast to table session room
      if (tableSessionId) {
        io.to(`table:${tableSessionId}`).emit("table_event", data);
        if (event === "ORDER_STATUS_CHANGED") {
          io.to(`table:${tableSessionId}`).emit("order_status_updated", data);
        } else if (event === "ORDER_PAID") {
          io.to(`table:${tableSessionId}`).emit("order_paid", data);
        }
      }

      // Also emit by orderId room if subscribed directly
      if (orderId) {
        io.to(`order:${orderId}`).emit("order_event", data);
      }

      return true;
    },
  };
}

module.exports = { createEventDispatcher };

