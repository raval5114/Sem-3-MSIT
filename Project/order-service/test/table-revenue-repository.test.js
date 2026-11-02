const test = require('node:test');
const assert = require('node:assert/strict');
const { createOrderRepository } = require('../src/order-repository');

test('table revenue aggregates only the tenant and inclusive UTC date range, with partial refunds capped at order total', async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [{ completed_orders: 2, gross_revenue: '120.00', refunds: '15.00', currency: 'INR' }] };
      return { rows: [{ table_id: 'table-a', completed_orders: 2, gross_revenue: '120.00', refunds: '15.00', currency: 'INR' }] };
    },
  };

  const report = await createOrderRepository(pool).getTableRevenue({
    restaurantId: 'restaurant-a', from: '2026-10-01', to: '2026-10-31',
  });

  assert.deepEqual(calls[0].params, ['restaurant-a', new Date('2026-10-01T00:00:00.000Z'), new Date('2026-11-01T00:00:00.000Z')]);
  assert.match(calls[0].sql, /o\.restaurant_id = \$1/);
  assert.match(calls[0].sql, /o\.payment_status IN \('PAID', 'REFUNDED'\)/);
  assert.match(calls[0].sql, /p\.status = 'REFUNDED'/);
  assert.match(calls[0].sql, /LEAST\(o\.total/);
  assert.equal(report.completedOrders, 2);
  assert.equal(report.grossRevenue, 120);
  assert.equal(report.refunds, 15);
  assert.equal(report.netRevenue, 105);
  assert.equal(report.period.from, '2026-10-01');
  assert.equal(report.period.to, '2026-10-31');
  assert.equal(report.tables[0].tableId, 'table-a');
});

test('table revenue filters a selected table using a parameterized tenant-scoped query', async () => {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ completed_orders: 1, gross_revenue: '50.00', refunds: '0.00', currency: 'INR' }] };
  } };

  const report = await createOrderRepository(pool).getTableRevenue({
    restaurantId: 'restaurant-a', tableId: 'table-a', from: '2026-10-20', to: '2026-10-20',
  });

  assert.deepEqual(calls[0].params, ['restaurant-a', new Date('2026-10-20T00:00:00.000Z'), new Date('2026-10-21T00:00:00.000Z'), 'table-a']);
  assert.match(calls[0].sql, /eligible\.table_id = \$4/);
  assert.equal(report.tableId, 'table-a');
  assert.equal(report.netRevenue, 50);
  assert.equal(calls.length, 1);
});
