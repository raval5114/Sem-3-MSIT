const crypto = require("node:crypto");

function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    restaurantId: row.restaurant_id,
    tableId: row.table_id,
    tableSessionId: row.table_session_id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    currency: row.currency,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    providerPaymentId: row.provider_payment_id,
    status: row.status,
    paymentMethod: row.payment_method,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createPaymentRepository(pool) {
  return {
    async findOrder(orderId) {
      const result = await pool.query("SELECT * FROM dineflow_orders WHERE id=$1", [orderId]);
      if (!result.rowCount) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        tableId: row.table_id,
        tableSessionId: row.table_session_id,
        customerId: row.customer_id,
        status: row.status,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        currency: row.currency,
        total: Number(row.total),
      };
    },

    async findPendingPaymentForOrder(orderId) {
      const result = await pool.query(
        "SELECT * FROM dineflow_payments WHERE order_id=$1 AND status='PENDING' ORDER BY created_at DESC LIMIT 1",
        [orderId]
      );
      return result.rowCount ? mapPayment(result.rows[0]) : null;
    },

    async findPaymentById(id) {
      const result = await pool.query("SELECT * FROM dineflow_payments WHERE id=$1", [id]);
      return result.rowCount ? mapPayment(result.rows[0]) : null;
    },

    async findPaymentByProviderOrderId(providerOrderId) {
      const result = await pool.query(
        "SELECT * FROM dineflow_payments WHERE provider_order_id=$1 ORDER BY created_at DESC LIMIT 1",
        [providerOrderId]
      );
      return result.rowCount ? mapPayment(result.rows[0]) : null;
    },

    async findPaymentsForOrder(orderId) {
      const result = await pool.query(
        "SELECT * FROM dineflow_payments WHERE order_id=$1 ORDER BY created_at DESC",
        [orderId]
      );
      return result.rows.map(mapPayment);
    },

    async createPayment(payment) {
      const id = payment.id || crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO dineflow_payments
         (id, order_id, restaurant_id, table_id, table_session_id, customer_id, amount, currency, provider, provider_order_id, status, payment_method, idempotency_key, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
         RETURNING *`,
        [
          id,
          payment.orderId,
          payment.restaurantId,
          payment.tableId,
          payment.tableSessionId,
          payment.customerId,
          payment.amount,
          payment.currency || "INR",
          payment.provider,
          payment.providerOrderId,
          payment.status || "PENDING",
          payment.paymentMethod || "ONLINE",
          payment.idempotencyKey || null,
          JSON.stringify(payment.metadata || {}),
        ]
      );
      return mapPayment(result.rows[0]);
    },

    async captureCashPayment({ orderId, restaurantId, cashierId, idempotencyKey }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const orderResult = await client.query(
          "SELECT * FROM dineflow_orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",
          [orderId, restaurantId]
        );
        if (!orderResult.rowCount) {
          const error = new Error("Order not found for this restaurant");
          error.status = 404;
          error.code = "ORDER_NOT_FOUND";
          throw error;
        }

        const order = orderResult.rows[0];
        const priorResult = await client.query(
          "SELECT * FROM dineflow_payments WHERE idempotency_key=$1",
          [idempotencyKey]
        );
        if (priorResult.rowCount) {
          const prior = mapPayment(priorResult.rows[0]);
          if (prior.orderId !== orderId || prior.restaurantId !== restaurantId || prior.paymentMethod !== "CASH") {
            const error = new Error("Idempotency key has already been used");
            error.status = 409;
            error.code = "IDEMPOTENCY_KEY_REUSED";
            throw error;
          }
          await client.query("COMMIT");
          return { payment: prior, order: mapPaymentOrder(order), alreadyRecorded: true };
        }
        if (order.payment_status === "PAID" || order.payment_status === "REFUNDED") {
          const error = new Error("This order is already settled");
          error.status = 409;
          error.code = "ORDER_ALREADY_PAID";
          throw error;
        }
        if (order.status === "CANCELLED") {
          const error = new Error("Cancelled orders cannot be settled");
          error.status = 409;
          error.code = "ORDER_CANCELLED";
          throw error;
        }

        await client.query(
          `UPDATE dineflow_payments
           SET status='FAILED', error_message='Replaced by cashier-recorded cash payment', updated_at=now()
           WHERE order_id=$1 AND restaurant_id=$2 AND status='PENDING'`,
          [orderId, restaurantId]
        );
        const paymentId = crypto.randomUUID();
        const paymentResult = await client.query(
          `INSERT INTO dineflow_payments
           (id, order_id, restaurant_id, table_id, table_session_id, amount, currency, provider,
            provider_payment_id, status, payment_method, idempotency_key, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'CASH',$8,'CAPTURED','CASH',$9,$10::jsonb)
           RETURNING *`,
          [
            paymentId, orderId, restaurantId, order.table_id, order.table_session_id,
            order.total, order.currency, `cash_${paymentId}`, idempotencyKey,
            JSON.stringify({ cashierId, receivedAt: new Date().toISOString() }),
          ]
        );
        const updatedOrder = await client.query(
          `UPDATE dineflow_orders
           SET payment_status='PAID',
               status=CASE WHEN status IN ('PAYMENT_PENDING','SUBMITTED') THEN 'PENDING_KITCHEN' ELSE status END
           WHERE id=$1 AND restaurant_id=$2
           RETURNING *`,
          [orderId, restaurantId]
        );
        await client.query("COMMIT");
        return {
          payment: mapPayment(paymentResult.rows[0]),
          order: mapPaymentOrder(updatedOrder.rows[0]),
          alreadyRecorded: false,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") {
          error.status = 409;
          error.code = "IDEMPOTENCY_KEY_REUSED";
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async capturePaymentAndReleaseOrder({ paymentId, orderId, restaurantId, providerPaymentId, paymentMethod, metadata = {} }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const orderResult = await client.query(
          "SELECT * FROM dineflow_orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",
          [orderId, restaurantId]
        );
        if (!orderResult.rowCount) {
          const error = new Error("Order not found");
          error.status = 404;
          error.code = "ORDER_NOT_FOUND";
          throw error;
        }
        const currentOrder = orderResult.rows[0];
        const currentPaymentResult = await client.query(
          "SELECT * FROM dineflow_payments WHERE id=$1 AND order_id=$2 AND restaurant_id=$3 FOR UPDATE",
          [paymentId, orderId, restaurantId]
        );
        if (!currentPaymentResult.rowCount) {
          const error = new Error("Payment record not found");
          error.status = 404;
          error.code = "PAYMENT_NOT_FOUND";
          throw error;
        }
        const currentPayment = mapPayment(currentPaymentResult.rows[0]);

        if (currentPayment.status === "CAPTURED" && currentOrder.payment_status === "PAID") {
          await client.query("COMMIT");
          return { payment: currentPayment, order: currentOrder };
        }
        if (currentPayment.status !== "PENDING" || ["PAID", "REFUNDED"].includes(currentOrder.payment_status)
            || currentOrder.status === "CANCELLED") {
          const error = new Error("This order or payment is no longer pending");
          error.status = 409;
          error.code = "PAYMENT_NOT_PENDING";
          throw error;
        }

        const paymentResult = await client.query(
          `UPDATE dineflow_payments
           SET status='CAPTURED', provider_payment_id=$1,
               payment_method=COALESCE($2, payment_method),
               metadata=metadata || $3::jsonb, updated_at=now()
           WHERE id=$4 AND status='PENDING'
           RETURNING *`,
          [providerPaymentId, paymentMethod || null, JSON.stringify(metadata), paymentId]
        );
        const updatedOrderResult = await client.query(
          `UPDATE dineflow_orders
           SET payment_status = 'PAID',
               status = CASE
                 WHEN status IN ('PAYMENT_PENDING', 'SUBMITTED') THEN 'PENDING_KITCHEN'
                 ELSE status
               END
           WHERE id = $1
           RETURNING *`,
          [orderId]
        );

        await client.query("COMMIT");
        return { payment: mapPayment(paymentResult.rows[0]), order: updatedOrderResult.rows[0] };
      } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") {
          error.status = 409;
          error.code = "IDEMPOTENCY_KEY_REUSED";
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async markPaymentFailed(paymentId, errorMessage) {
      const result = await pool.query(
        `UPDATE dineflow_payments
         SET status = 'FAILED',
             error_message = $1,
             updated_at = now()
         WHERE id = $2 AND status = 'PENDING'
         RETURNING *`,
        [errorMessage, paymentId]
      );
      return result.rowCount ? mapPayment(result.rows[0]) : null;
    },

    async markPaymentRefunded({ paymentId, orderId, refundAmount, reason }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const paymentResult = await client.query(
          `UPDATE dineflow_payments
           SET status = 'REFUNDED',
               metadata = metadata || $1::jsonb,
               updated_at = now()
           WHERE id = $2
           RETURNING *`,
          [JSON.stringify({ refundReason: reason, refundAmount }), paymentId]
        );
        await client.query(
          `UPDATE dineflow_orders
           SET payment_status = 'REFUNDED'
           WHERE id = $1`,
          [orderId]
        );
        await client.query("COMMIT");
        return paymentResult.rowCount ? mapPayment(paymentResult.rows[0]) : null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function mapPaymentOrder(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tableId: row.table_id,
    tableSessionId: row.table_session_id,
    status: row.status,
    paymentStatus: row.payment_status,
    total: Number(row.total),
    currency: row.currency,
  };
}

module.exports = { createPaymentRepository };
