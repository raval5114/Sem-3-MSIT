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

    async capturePaymentAndReleaseOrder({ paymentId, orderId, providerPaymentId, metadata = {} }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Update payment status to CAPTURED
        const paymentResult = await client.query(
          `UPDATE dineflow_payments
           SET status = 'CAPTURED',
               provider_payment_id = $1,
               metadata = metadata || $2::jsonb,
               updated_at = now()
           WHERE id = $3 AND status != 'CAPTURED'
           RETURNING *`,
          [providerPaymentId, JSON.stringify(metadata), paymentId]
        );

        // If already captured previously (idempotent), fetch current record
        let capturedPayment;
        if (paymentResult.rowCount > 0) {
          capturedPayment = mapPayment(paymentResult.rows[0]);
        } else {
          const existing = await client.query("SELECT * FROM dineflow_payments WHERE id = $1", [paymentId]);
          capturedPayment = mapPayment(existing.rows[0]);
        }

        // 2. Update order status: payment_status -> PAID, status -> PENDING_KITCHEN
        const orderResult = await client.query(
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

        return {
          payment: capturedPayment,
          order: orderResult.rows[0],
        };
      } catch (error) {
        await client.query("ROLLBACK");
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
         WHERE id = $2
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

module.exports = { createPaymentRepository };

