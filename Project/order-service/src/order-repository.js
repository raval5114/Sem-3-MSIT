const crypto = require("node:crypto");

function mapOrder(row, items) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tableId: row.table_id,
    tableSessionId: row.table_session_id,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    createdAt: row.created_at,
    items,
  };
}

function createOrderRepository(pool) {
  return {
    async create(order) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `INSERT INTO dineflow_orders
           (id, restaurant_id, table_id, table_session_id, customer_id, status, payment_method, payment_status, currency, subtotal, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [order.id, order.restaurantId, order.tableId, order.tableSessionId, order.customerId, order.status,
            order.paymentMethod, order.paymentStatus, order.currency, order.subtotal, order.total],
        );
        const savedItems = [];
        for (const item of order.items) {
          const itemResult = await client.query(
            `INSERT INTO dineflow_order_items
             (id, order_id, product_id, item_name, quantity, unit_price, line_total, selections)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,
            [crypto.randomUUID(), order.id, item.productId, item.name, item.quantity, item.unitPrice, item.lineTotal, JSON.stringify(item.selections)],
          );
          savedItems.push({ ...item, id: itemResult.rows[0].id });
        }
        await client.query("COMMIT");
        return mapOrder(result.rows[0], savedItems);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async findById(id) {
      const result = await pool.query("SELECT * FROM dineflow_orders WHERE id=$1", [id]);
      if (!result.rowCount) return null;
      const lines = await pool.query("SELECT id, product_id, item_name, quantity, unit_price, line_total, selections FROM dineflow_order_items WHERE order_id=$1 ORDER BY created_at", [id]);
      return mapOrder(result.rows[0], lines.rows.map((row) => ({
        id: row.id, productId: row.product_id, name: row.item_name, quantity: row.quantity,
        unitPrice: Number(row.unit_price), lineTotal: Number(row.line_total), selections: row.selections,
      })));
    },
    async updateStatus(id, newStatus) {
      const result = await pool.query(
        "UPDATE dineflow_orders SET status=$1 WHERE id=$2 RETURNING *",
        [newStatus, id]
      );
      if (!result.rowCount) return null;
      const lines = await pool.query("SELECT id, product_id, item_name, quantity, unit_price, line_total, selections FROM dineflow_order_items WHERE order_id=$1 ORDER BY created_at", [id]);
      return mapOrder(result.rows[0], lines.rows.map((row) => ({
        id: row.id, productId: row.product_id, name: row.item_name, quantity: row.quantity,
        unitPrice: Number(row.unit_price), lineTotal: Number(row.line_total), selections: row.selections,
      })));
    },
    async findActiveOrdersByRestaurant(restaurantId) {
      const result = await pool.query(
        `SELECT * FROM dineflow_orders
         WHERE restaurant_id=$1 AND status IN ('SUBMITTED', 'PENDING_KITCHEN', 'ACCEPTED', 'PREPARING', 'READY')
         ORDER BY created_at ASC`,
        [restaurantId]
      );
      const orders = [];
      for (const row of result.rows) {
        const lines = await pool.query(
          "SELECT id, product_id, item_name, quantity, unit_price, line_total, selections FROM dineflow_order_items WHERE order_id=$1 ORDER BY created_at",
          [row.id]
        );
        orders.push(mapOrder(row, lines.rows.map((line) => ({
          id: line.id, productId: line.product_id, name: line.item_name, quantity: line.quantity,
          unitPrice: Number(line.unit_price), lineTotal: Number(line.line_total), selections: line.selections,
        }))));
      }
      return orders;
    },
    async findStatusById(id) {
      const result = await pool.query("SELECT id, restaurant_id, table_id, table_session_id, status, payment_status, created_at FROM dineflow_orders WHERE id=$1", [id]);
      if (!result.rowCount) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        tableId: row.table_id,
        tableSessionId: row.table_session_id,
        status: row.status,
        paymentStatus: row.payment_status,
        updatedAt: row.created_at,
      };
    },
    async getTableRevenue({ restaurantId, tableId, from, to }) {
      const isSpecificTable = Boolean(tableId && tableId !== "all");
      const fromTimestamp = new Date(`${from}T00:00:00.000Z`);
      const toExclusive = new Date(`${to}T00:00:00.000Z`);
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
      const params = [restaurantId, fromTimestamp, toExclusive];
      let tableCondition = "";
      if (isSpecificTable) {
        params.push(tableId);
        tableCondition = " AND eligible.table_id = $" + params.length;
      }

      const eligibleOrders = `
        WITH eligible AS (
          SELECT o.id, o.table_id, o.total, o.currency, o.payment_status,
            CASE WHEN o.payment_status = 'REFUNDED' THEN
              LEAST(o.total, COALESCE((
                SELECT SUM(COALESCE(NULLIF(p.metadata->>'refundAmount', '')::numeric, p.amount))
                FROM dineflow_payments p
                WHERE p.order_id = o.id
                  AND p.restaurant_id = o.restaurant_id
                  AND p.status = 'REFUNDED'
              ), o.total))
            ELSE 0 END AS refund_amount
          FROM dineflow_orders o
          WHERE o.restaurant_id = $1
            AND o.status != 'CANCELLED'
            AND o.payment_status IN ('PAID', 'REFUNDED')
            AND o.created_at >= $2
            AND o.created_at < $3
        )
      `;
      const ordersQuery = `${eligibleOrders}
        SELECT
          COUNT(eligible.id)::int as completed_orders,
          COALESCE(SUM(eligible.total), 0)::numeric as gross_revenue,
          COALESCE(SUM(eligible.refund_amount), 0)::numeric as refunds,
          COALESCE(MAX(eligible.currency), 'INR') as currency
        FROM eligible
        WHERE TRUE ${tableCondition}
      `;
      const ordersRes = await pool.query(ordersQuery, params);
      const row = ordersRes.rows[0] || {};
      const completedOrders = Number(row.completed_orders || 0);
      const grossRevenue = Number(Number(row.gross_revenue || 0).toFixed(2));
      const refunds = Number(Number(row.refunds || 0).toFixed(2));
      const currency = row.currency || "INR";
      const netRevenue = Number(Math.max(0, grossRevenue - refunds).toFixed(2));

      let tableBreakdown;
      if (!isSpecificTable) {
        const breakdownQuery = `${eligibleOrders}
          SELECT
            eligible.table_id,
            COUNT(eligible.id)::int as completed_orders,
            COALESCE(SUM(eligible.total), 0)::numeric as gross_revenue,
            COALESCE(SUM(eligible.refund_amount), 0)::numeric as refunds,
            COALESCE(MAX(eligible.currency), 'INR') as currency
          FROM eligible
          GROUP BY eligible.table_id, eligible.currency
          ORDER BY gross_revenue DESC
        `;
        const breakdownRes = await pool.query(breakdownQuery, params.slice(0, 3));
        tableBreakdown = breakdownRes.rows.map((r) => {
          const gross = Number(Number(r.gross_revenue).toFixed(2));
          const ref = Number(Number(r.refunds).toFixed(2));
          return {
            tableId: r.table_id,
            completedOrders: Number(r.completed_orders),
            grossRevenue: gross,
            refunds: ref,
            netRevenue: Number(Math.max(0, gross - ref).toFixed(2)),
            currency: r.currency || currency,
          };
        });
      }

      const result = {
        period: { from, to },
        completedOrders,
        grossRevenue,
        refunds,
        netRevenue,
        currency,
      };

      if (isSpecificTable) {
        result.tableId = tableId;
      } else {
        result.restaurantId = restaurantId;
        result.tables = tableBreakdown || [];
      }

      return result;
    },
    async checkCrossTenantTable({ restaurantId, tableId }) {
      if (!tableId || tableId === "all") return false;
      try {
        const res = await pool.query(
          "SELECT 1 FROM dineflow_orders WHERE table_id = $1 AND restaurant_id != $2 LIMIT 1",
          [tableId, restaurantId]
        );
        return res.rowCount > 0;
      } catch {
        return false;
      }
    },
  };
}

module.exports = { createOrderRepository };
