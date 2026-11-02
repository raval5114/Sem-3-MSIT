const assert = require("node:assert/strict");
const test = require("node:test");

const Ingredient = require("../models/ingrediants.model");
const Allergen = require("../models/allergen.model");
const Variant = require("../models/variants.model");
const Product = require("../models/products.model");
const ModifierGroup = require("../models/modifier.model");

const cases = [
  ["ingredient", Ingredient, { restaurantId: "rest_test", name: "Milk", category: "DAIRY" }],
  ["allergen", Allergen, { code: "MILK", name: "Milk" }],
  ["variant", Variant, {
    restaurantId: "rest_test",
    productId: "product_test",
    name: "Size",
    options: [{ optionId: "small", name: "Small" }],
  }],
  ["product", Product, {
    restaurantId: "rest_test",
    categoryId: "category_test",
    name: "Soup",
    basePrice: 8,
  }],
  ["modifier group", ModifierGroup, {
    restaurantId: "rest_test",
    productId: "product_test",
    name: "Toppings",
    options: [{ optionId: "cheese", name: "Cheese" }],
  }],
];

for (const [label, Model, fields] of cases) {
  test(`${label} receives a generated string _id when omitted`, async () => {
    const document = new Model(fields);

    assert.equal(typeof document._id, "string");
    assert.ok(document._id.length > 0);
    await assert.doesNotReject(() => document.validate());
  });
}
