const test = require("node:test");
const assert = require("node:assert/strict");
const { createOrderRepository } = require("../src/order-repository");

const order = {
  id: "33333333-3333-4333-8333-333333333333", restaurantId: "r1", tableId: "11111111-1111-4111-8111-111111111111",
  tableSessionId: "22222222-2222-4222-8222-222222222222", customerId: "guest", status: "SUBMITTED",
  paymentMethod: "PAY_AT_COUNTER", paymentStatus: "UNPAID", currency: "INR", subtotal: 100, total: 100,
  items: [{ productId: "food-1", name: "Dosa", quantity: 1, unitPrice: 100, lineTotal: 100, selections: [] }],
};

test("persists order and immutable line snapshot in a single transaction", async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("INSERT INTO dineflow_orders")) return { rows: [{ id: order.id, restaurant_id: "r1", table_id: order.tableId, table_session_id: order.tableSessionId, status: "SUBMITTED", payment_method: "PAY_AT_COUNTER", payment_status: "UNPAID", currency: "INR", subtotal: "100.00", total: "100.00", created_at: new Date("2026-10-21T00:00:00Z") }] };
      if (sql.startsWith("INSERT INTO dineflow_order_items")) return { rows: [{ id: "item-id" }] };
      return { rows: [] };
    }, release: () => calls.push({ sql: "RELEASE" }),
  };
  const repository = createOrderRepository({ connect: async () => client });
  const saved = await repository.create(order);
  assert.deepEqual(calls.map((call) => call.sql === "RELEASE" ? call.sql : call.sql.split(" ")[0]), ["BEGIN", "INSERT", "INSERT", "COMMIT", "RELEASE"]);
  assert.equal(saved.total, 100);
  assert.equal(saved.items[0].id, "item-id");
  assert.equal(calls[2].params[7], "[]");
});

test("rolls back when inserting a line snapshot fails", async () => {
  const calls = [];
  const client = { query: async (sql) => { calls.push(sql); if (sql.startsWith("INSERT INTO dineflow_order_items")) throw new Error("insert failed"); return { rows: [{ id: order.id, restaurant_id: "r1", table_id: order.tableId, table_session_id: order.tableSessionId, status: "SUBMITTED", payment_method: "PAY_AT_COUNTER", payment_status: "UNPAID", currency: "INR", subtotal: "100.00", total: "100.00", created_at: new Date() }] }; }, release: () => {} };
  const repository = createOrderRepository({ connect: async () => client });
  await assert.rejects(repository.create(order), /insert failed/);
  assert.equal(calls.at(-1), "ROLLBACK");
});
