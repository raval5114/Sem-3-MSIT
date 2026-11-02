const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const Category = require("../models/categories.model");
const Product = require("../models/products.model");
const categoryService = require("../service/categories.service");
const productService = require("../service/product.service");
const recipeService = require("../service/recipe.service");
const knowledgeGraphService = require("../service/knowledge_graph.service");
const adaptiveMenuService = require("../service/menu.service");

async function withMemoryModels(run) {
  const categories = new Map();
  const products = new Map();
  const originalCategoryCreate = Category.create;
  const originalCategoryFindOne = Category.findOne;
  const originalProductCreate = Product.create;

  Category.create = async (data) => {
    const document = new Category(data);
    await document.validate();
    categories.set(String(document._id), document);
    return document;
  };
  Category.findOne = async (filter) => {
    return [...categories.values()].find((document) =>
      Object.entries(filter).every(([key, value]) =>
        String(document[key]) === String(value)
      )
    ) || null;
  };
  Product.create = async (data) => {
    const document = new Product(data);
    await document.validate();
    products.set(String(document._id), document);
    return document;
  };

  try {
    await run({ categories, products });
  } finally {
    Category.create = originalCategoryCreate;
    Category.findOne = originalCategoryFindOne;
    Product.create = originalProductCreate;
  }
}

describe("CategoryService and MenuItemService", { concurrency: false }, () => {
  it("rejects a category missing its required name", async () => {
    await withMemoryModels(async () => {
      await assert.rejects(
        categoryService.createCategory({ restaurantId: "test_restaurant" }),
        /name/i
      );
    });
  });

  it("rejects a menu item with a negative price", async () => {
    await withMemoryModels(async () => {
      const category = await categoryService.createCategory({
        restaurantId: "test_restaurant",
        name: "Active Category",
      });

      await assert.rejects(
        productService.createProduct({
          _id: "test_negative_price_item",
          restaurantId: "test_restaurant",
          categoryId: String(category._id),
          name: "Negative Price Item",
          basePrice: -1,
        }),
        /basePrice|greater than or equal to 0/i
      );
    });
  });

  it("rejects a menu item whose category is inactive", async () => {
    await withMemoryModels(async () => {
      const category = await categoryService.createCategory({
        restaurantId: "test_restaurant",
        name: "Inactive Category",
        isActive: false,
      });

      await assert.rejects(
        productService.createProduct({
          _id: "test_inactive_category_item",
          restaurantId: "test_restaurant",
          categoryId: String(category._id),
          name: "Item In Inactive Category",
          basePrice: 100,
        }),
        /inactive|unavailable|not active/i
      );
    });
  });

  it("creates a menu item in an active category", async () => {
    await withMemoryModels(async ({ products }) => {
      const category = await categoryService.createCategory({
        restaurantId: "test_restaurant",
        name: "Active Category",
        isActive: true,
      });

      const product = await productService.createProduct({
        _id: "test_valid_menu_item",
        restaurantId: "test_restaurant",
        categoryId: String(category._id),
        name: "Valid Menu Item",
        basePrice: 100,
      });

      assert.equal(product.name, "Valid Menu Item");
      assert.equal(products.size, 1);
    });
  });
});

describe("RecipeService, KnowledgeGraphService, and AdaptiveMenuService", () => {
  it.todo("RecipeService should update a recipe and preserve its version history");
  it.todo("KnowledgeGraphService should derive an allergen relationship from recipe ingredients");
  it.todo("AdaptiveMenuService should filter items containing excluded allergens");

  it("documents which production services are currently missing", () => {
    assert.deepEqual(Object.keys(recipeService), []);
    assert.deepEqual(Object.keys(knowledgeGraphService), []);
    assert.deepEqual(Object.keys(adaptiveMenuService), []);
  });
});
