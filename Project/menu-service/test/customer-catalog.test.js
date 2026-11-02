const test = require("node:test");
const assert = require("node:assert/strict");
const { getCustomerCatalog } = require("../service/customer-catalog.service");

function query(rows) { return { sort() { return this; }, lean: async () => rows }; }

test("builds restaurant catalog with active products, variants, and modifier groups only", async () => {
  const category = { _id: "cat-1", name: "Breakfast", isActive: true };
  const models = {
    Category: { find: (filter) => { assert.deepEqual(filter, { restaurantId: "r1", isActive: true }); return query([category]); } },
    Product: { find: (filter) => {
      assert.equal(filter.restaurantId, "r1"); assert.deepEqual(filter.categoryId.$in, ["cat-1"]);
      assert.equal(filter.status, "ACTIVE"); assert.equal(filter.isAvailable, true);
      return query([{ _id: "p1", restaurantId: "r1", categoryId: "cat-1", name: "Dosa" }]);
    } },
    Variant: { find: () => query([{ _id: "v1", productId: "p1", isActive: true }]) },
    ModifierGroup: { find: () => query([{ _id: "m1", productId: "p1", isActive: true }]) },
  };
  const result = await getCustomerCatalog("r1", models);
  assert.equal(result.length, 1);
  assert.equal(result[0].products[0].variants[0]._id, "v1");
  assert.equal(result[0].products[0].modifierGroups[0]._id, "m1");
});

test("avoids child queries when restaurant has no active categories", async () => {
  let childQueried = false;
  const models = {
    Category: { find: () => query([]) }, Product: { find: () => { childQueried = true; return query([]); } },
    Variant: { find: () => { childQueried = true; return query([]); } }, ModifierGroup: { find: () => { childQueried = true; return query([]); } },
  };
  assert.deepEqual(await getCustomerCatalog("empty", models), []);
  assert.equal(childQueried, false);
});
