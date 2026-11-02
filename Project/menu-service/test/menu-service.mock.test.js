const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const Category = require("../models/categories.model");
const Ingredient = require("../models/ingrediants.model");
const Product = require("../models/products.model");
const categoryService = require("../service/categories.service");
const ingredientService = require("../service/ingredient.service");
const productService = require("../service/product.service");

function classify(validInput, accepted) {
  if (validInput) return accepted ? "TP" : "FN";
  return accepted ? "FP" : "TN";
}

async function execute(operation) {
  try {
    return { accepted: true, value: await operation() };
  } catch (error) {
    return { accepted: false, error };
  }
}

describe("DineFlow menu E2E workflow with mock data", { concurrency: false }, () => {
  it("classifies TP, FN, TN, and FP outcomes", (t) => {
    const cases = [
      { valid: true, accepted: true, expected: "TP" },
      { valid: true, accepted: false, expected: "FN" },
      { valid: false, accepted: false, expected: "TN" },
      { valid: false, accepted: true, expected: "FP" },
    ];

    for (const item of cases) {
      const observed = classify(item.valid, item.accepted);
      t.diagnostic(
        `ground truth=${item.valid ? "valid" : "invalid"}; ` +
        `filter=${item.accepted ? "included" : "excluded"}; ${observed}`
      );
      assert.equal(observed, item.expected);
    }
  });

  it("runs category -> ingredients -> recipes -> items -> graph -> profile -> filter", async (t) => {
    const categories = new Map();
    const ingredients = new Map();
    const recipes = new Map();
    const products = new Map();
    const stages = [];
    const restaurantId = "mock_restaurant_e2e";

    const originalCategoryCreate = Category.create;
    const originalCategoryFindOne = Category.findOne;
    const originalIngredientCreate = Ingredient.create;
    const originalProductCreate = Product.create;

    // Use actual Mongoose schemas, with in-memory persistence for this run.
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
    Ingredient.create = async (data) => {
      const document = new Ingredient(data);
      await document.validate();
      ingredients.set(String(document._id), document);
      return document;
    };
    Product.create = async (data) => {
      const document = new Product(data);
      await document.validate();
      products.set(String(document._id), document);
      return document;
    };

    // These relations are mock contract data until recipe/graph modules exist.
    const ingredientAllergens = {
      ingredient_milk: ["MILK"],
      ingredient_paneer: ["MILK"],
      ingredient_peanut: ["PEANUT"],
      ingredient_noodles: [],
    };

    async function createRecipe(data) {
      for (const row of data.ingredients) {
        assert.ok(ingredients.has(row.ingredientId), `Missing ingredient ${row.ingredientId}`);
      }
      const recipe = { ...data, status: "ACTIVE" };
      recipes.set(recipe._id, recipe);
      return recipe;
    }

    function buildFoodGraph() {
      const graph = new Map();
      for (const product of products.values()) {
        const recipe = recipes.get(product.recipeId);
        assert.ok(recipe, `Missing recipe ${product.recipeId}`);
        assert.equal(recipe.foodItemId, product._id);

        const allergenCodes = new Set();
        const ingredientNames = recipe.ingredients.map((row) => {
          for (const code of ingredientAllergens[row.ingredientId] || []) {
            allergenCodes.add(code);
          }
          return ingredients.get(row.ingredientId).name;
        });

        graph.set(product._id, {
          productId: product._id,
          recipeId: recipe._id,
          ingredients: ingredientNames,
          dietaryTags: product.dietaryTags,
          allergens: [...allergenCodes].map((code) => ({
            code,
            status: "CONTAINS",
          })),
        });
      }
      return graph;
    }

    function queryFoodProfile(graph, productId) {
      return graph.get(productId) || null;
    }

    function filterMenu(graph, { diet, excludeAllergens }) {
      return [...graph.values()].filter((profile) => {
        const hasDiet = !diet || profile.dietaryTags.includes(diet);
        const hasExcludedAllergen = profile.allergens.some((allergen) =>
          excludeAllergens.includes(allergen.code)
        );
        return hasDiet && !hasExcludedAllergen;
      });
    }

    try {
      // 1. Create Category
      const category = await categoryService.createCategory({
        restaurantId,
        name: "Mock Test Menu",
      });
      stages.push("category");
      t.diagnostic("stage 1/7: category created");

      // 2. Create Ingredients
      const ingredientRows = [
        { _id: "ingredient_milk", name: "Milk", category: "DAIRY" },
        { _id: "ingredient_paneer", name: "Paneer", category: "DAIRY" },
        { _id: "ingredient_peanut", name: "Peanut", category: "NUT" },
        { _id: "ingredient_noodles", name: "Noodles", category: "GRAIN" },
      ];
      for (const row of ingredientRows) {
        await ingredientService.createIngredient({ restaurantId, ...row });
      }
      stages.push("ingredients");
      t.diagnostic(`stage 2/7: ${ingredients.size} ingredients created`);

      // 3. Create Recipes before their menu-item documents, as in the guide.
      const recipesToCreate = [
        {
          _id: "recipe_paneer_pizza_v1",
          foodItemId: "food_paneer_pizza",
          ingredients: [
            { ingredientId: "ingredient_paneer", quantity: 100, unit: "GRAM" },
            { ingredientId: "ingredient_milk", quantity: 80, unit: "GRAM" },
          ],
        },
        {
          _id: "recipe_peanut_noodles_v1",
          foodItemId: "food_peanut_noodles",
          ingredients: [
            { ingredientId: "ingredient_noodles", quantity: 1, unit: "UNIT" },
            { ingredientId: "ingredient_peanut", quantity: 30, unit: "GRAM" },
          ],
        },
      ];
      for (const recipe of recipesToCreate) await createRecipe(recipe);
      stages.push("recipes");
      t.diagnostic(`stage 3/7: ${recipes.size} recipes created`);

      // 4. Create Menu Items using those recipes.
      const menuItems = [
        {
          _id: "food_paneer_pizza",
          restaurantId,
          categoryId: String(category._id),
          name: "Paneer Pizza",
          basePrice: 299,
          dietaryTags: ["VEGETARIAN"],
          recipeId: "recipe_paneer_pizza_v1",
        },
        {
          _id: "food_peanut_noodles",
          restaurantId,
          categoryId: String(category._id),
          name: "Peanut Noodles",
          basePrice: 199,
          dietaryTags: ["VEGETARIAN", "VEGAN"],
          recipeId: "recipe_peanut_noodles_v1",
        },
      ];
      for (const item of menuItems) {
        await productService.createProduct(item);
      }
      stages.push("menu-items");
      t.diagnostic(`stage 4/7: ${products.size} menu items created`);

      // 5. Build Food Graph
      const graph = buildFoodGraph();
      stages.push("food-graph");
      t.diagnostic(`stage 5/7: graph built for ${graph.size} menu items`);

      // 6. Query Food Profile
      const paneerProfile = queryFoodProfile(graph, "food_paneer_pizza");
      assert.deepEqual(paneerProfile.ingredients, ["Paneer", "Milk"]);
      assert.deepEqual(paneerProfile.dietaryTags, ["VEGETARIAN"]);
      assert.deepEqual(paneerProfile.allergens, [
        { code: "MILK", status: "CONTAINS" },
      ]);
      stages.push("food-profile");
      t.diagnostic("stage 6/7: food profile includes ingredients, diet, and allergen");

      // 7. Apply Dietary/Allergen Filter
      const eligibleMenu = filterMenu(graph, {
        diet: "VEGETARIAN",
        excludeAllergens: ["PEANUT"],
      });
      const includedPaneer = eligibleMenu.some(
        (profile) => profile.productId === "food_paneer_pizza"
      );
      const includedPeanut = eligibleMenu.some(
        (profile) => profile.productId === "food_peanut_noodles"
      );
      assert.equal(classify(true, includedPaneer), "TP");
      assert.equal(classify(false, includedPeanut), "TN");
      assert.equal(includedPaneer, true);
      assert.equal(includedPeanut, false);

      const milkExcludedMenu = filterMenu(graph, {
        diet: "VEGETARIAN",
        excludeAllergens: ["MILK"],
      });
      assert.equal(
        milkExcludedMenu.some((profile) => profile.productId === "food_paneer_pizza"),
        false
      );
      stages.push("dietary-allergen-filter");
      t.diagnostic("stage 7/7: filter retained eligible item and excluded peanut item");

      assert.deepEqual(stages, [
        "category",
        "ingredients",
        "recipes",
        "menu-items",
        "food-graph",
        "food-profile",
        "dietary-allergen-filter",
      ]);
      assert.equal(categories.size, 1);
      assert.equal(ingredients.size, 4);
      assert.equal(recipes.size, 2);
      assert.equal(products.size, 2);
    } finally {
      Category.create = originalCategoryCreate;
      Category.findOne = originalCategoryFindOne;
      Ingredient.create = originalIngredientCreate;
      Product.create = originalProductCreate;
    }
  });
});
