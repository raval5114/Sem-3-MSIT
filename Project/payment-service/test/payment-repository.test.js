const test = require("node:test");
const assert = require("node:assert/strict");
const { createPaymentRepository } = require("../src/payment-repository");

test("cash settlement locks the order and commits payment plus order state atomically", async () => {
  const statements = [];
  const order = {
    id: "order-1",
    restaurant_id: "restaurant-1",
    table_id: "table-1",
    table_session_id: "session-1",
    status: "SERVED",
    payment_status: "UNPAID",
    currency: "INR",
    total: "125.00",
  };
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith("SELECT * FROM dineflow_orders")) return { rowCount: 1, rows: [order] };
      if (sql.startsWith("SELECT * FROM dineflow_payments WHERE idempotency_key")) return { rowCount: 0, rows: [] };
      if (sql.startsWith("INSERT INTO dineflow_payments")) {
        return {
          rowCount: 1,
          rows: [{
            id: "payment-1", order_id: "order-1", restaurant_id: "restaurant-1",
            table_id: "table-1", table_session_id: "session-1", amount: "125.00",
            currency: "INR", provider: "CASH", provider_payment_id: "cash-payment-1",
            status: "CAPTURED", payment_method: "CASH", metadata: { cashierId: "cashier-1" },
          }],
        };
      }
      if (sql.startsWith("UPDATE dineflow_orders")) {
        return { rowCount: 1, rows: [{ ...order, payment_status: "PAID" }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  const repository = createPaymentRepository({ connect: async () => client });

  const result = await repository.captureCashPayment({
    orderId: "order-1",
    restaurantId: "restaurant-1",
    cashierId: "cashier-1",
    idempotencyKey: "counter-1",
  });

  assert.equal(result.payment.status, "CAPTURED");
  assert.equal(result.payment.paymentMethod, "CASH");
  assert.equal(result.payment.metadata.cashierId, "cashier-1");
  assert.equal(result.order.paymentStatus, "PAID");
  assert.equal(result.alreadyRecorded, false);
  assert.match(statements[1], /FOR UPDATE/);
  assert.ok(statements.indexOf("COMMIT") > statements.findIndex((sql) => sql.startsWith("UPDATE dineflow_orders")));
});
