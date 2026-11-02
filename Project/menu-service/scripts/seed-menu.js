const path = require("node:path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const Category = require("../models/categories.model");
const Product = require("../models/products.model");
const Ingredient = require("../models/ingrediants.model");
const Allergen = require("../models/allergen.model");
const Variant = require("../models/variants.model");
const ModifierGroup = require("../models/modifier.model");

const restaurantId = process.env.SEED_RESTAURANT_ID || "rest_123";

const categorySeeds = [
  ["Pizza", "Hand-stretched pizzas from the oven"],
  ["Pasta", "Fresh pasta and slow-simmered sauces"],
  ["Small plates", "Starters and shareable sides"],
  ["Mains", "Comforting restaurant favourites"],
  ["Desserts", "Something sweet to finish"],
  ["Beverages", "Coffee, tea, and coolers"],
];

const ingredientSeeds = [
  ["Mozzarella", "DAIRY", "Fresh mozzarella cheese"],
  ["Parmesan", "DAIRY", "Aged hard cheese"],
  ["Paneer", "DAIRY", "Fresh Indian cottage cheese"],
  ["Milk", "DAIRY", "Whole milk"],
  ["Wheat flour", "GRAINS", "Stone-ground wheat flour"],
  ["Tomato", "PRODUCE", "Ripe tomatoes"],
  ["Basil", "HERBS", "Fresh basil leaves"],
  ["Mushroom", "PRODUCE", "Button mushrooms"],
  ["Olive oil", "PANTRY", "Extra virgin olive oil"],
  ["Chicken", "PROTEIN", "Free-range chicken"],
  ["Egg", "PROTEIN", "Farm eggs"],
  ["Cocoa", "PANTRY", "Unsweetened cocoa powder"],
];

const allergenSeeds = [
  ["MILK", "Milk", "Milk and milk-derived ingredients"],
  ["WHEAT", "Wheat", "Wheat and gluten-containing grains"],
  ["EGG", "Egg", "Egg and egg-derived ingredients"],
  ["PEANUT", "Peanut", "Peanuts and peanut-derived ingredients"],
  ["TREE_NUT", "Tree nuts", "Tree nuts and nut-derived ingredients"],
  ["SOY", "Soy", "Soybeans and soy-derived ingredients"],
  ["FISH", "Fish", "Fish and fish-derived ingredients"],
  ["SHELLFISH", "Shellfish", "Crustaceans and shellfish"],
];

const products = [
  { id: "margherita-pizza", name: "Margherita Pizza", category: "Pizza", price: 399, description: "Tomato, mozzarella, basil, and olive oil.", tags: ["vegetarian"], variant: ["Regular", "Large"], modifiers: [{ name: "Extra toppings", options: ["Olives", "Mushrooms", "Jalapeños"] }] },
  { id: "farmhouse-pizza", name: "Farmhouse Pizza", category: "Pizza", price: 479, description: "Bell pepper, onion, mushroom, tomato, and mozzarella.", tags: ["vegetarian"], variant: ["Regular", "Large"], modifiers: [{ name: "Extra toppings", options: ["Olives", "Sweet corn", "Jalapeños"] }] },
  { id: "paneer-tikka-pizza", name: "Paneer Tikka Pizza", category: "Pizza", price: 499, description: "Tandoori paneer, peppers, onion, and mint sauce.", tags: ["vegetarian", "spicy"], variant: ["Regular", "Large"] },
  { id: "four-cheese-pizza", name: "Four Cheese Pizza", category: "Pizza", price: 529, description: "Mozzarella, parmesan, cheddar, and blue cheese.", tags: ["vegetarian"], variant: ["Regular", "Large"] },
  { id: "spicy-corn-pizza", name: "Spicy Corn Pizza", category: "Pizza", price: 429, description: "Sweet corn, chili oil, and mozzarella.", tags: ["vegetarian", "spicy"], variant: ["Regular", "Large"] },
  { id: "arrabbiata-penne", name: "Arrabbiata Penne", category: "Pasta", price: 349, description: "Penne in a bright tomato and chili sauce.", tags: ["vegetarian", "spicy"], variant: ["Regular", "Large"], modifiers: [{ name: "Pasta add-ons", options: ["Parmesan", "Grilled chicken"] }] },
  { id: "alfredo-mushroom-pasta", name: "Alfredo Mushroom Pasta", category: "Pasta", price: 399, description: "Creamy parmesan sauce with sautéed mushrooms.", tags: ["vegetarian"], variant: ["Regular", "Large"] },
  { id: "pesto-penne", name: "Pesto Penne", category: "Pasta", price: 379, description: "Basil pesto, parmesan, and toasted seeds.", tags: ["vegetarian"], variant: ["Regular", "Large"] },
  { id: "classic-lasagna", name: "Classic Lasagna", category: "Pasta", price: 449, description: "Layered pasta, slow-cooked tomato, and béchamel.", tags: ["vegetarian"] },
  { id: "garlic-bread", name: "Garlic Bread", category: "Small plates", price: 179, description: "Toasted sourdough with garlic butter and herbs.", tags: ["vegetarian"], modifiers: [{ name: "Bread finish", options: ["Add mozzarella", "Add chili flakes"] }] },
  { id: "tomato-bruschetta", name: "Tomato Bruschetta", category: "Small plates", price: 219, description: "Toasted bread topped with tomato, basil, and olive oil.", tags: ["vegetarian"] },
  { id: "crispy-calamari", name: "Crispy Calamari", category: "Small plates", price: 329, description: "Lightly fried calamari with lemon and herb dip.", tags: [] },
  { id: "grilled-chicken-bowl", name: "Grilled Chicken Bowl", category: "Mains", price: 429, description: "Grilled chicken, greens, grains, and lemon dressing.", tags: ["high-protein"], variant: ["Regular", "Large"], modifiers: [{ name: "Bowl extras", options: ["Avocado", "Extra chicken"] }] },
  { id: "paneer-butter-masala", name: "Paneer Butter Masala", category: "Mains", price: 389, description: "Paneer in a buttery tomato gravy, served with rice.", tags: ["vegetarian"] },
  { id: "butter-chicken", name: "Butter Chicken", category: "Mains", price: 449, description: "Tandoor chicken in a creamy tomato sauce with rice.", tags: ["high-protein"] },
  { id: "tiramisu", name: "Tiramisu", category: "Desserts", price: 249, description: "Coffee-soaked sponge, mascarpone, and cocoa.", tags: ["vegetarian"] },
  { id: "chocolate-brownie", name: "Chocolate Brownie", category: "Desserts", price: 199, description: "Warm dark chocolate brownie with vanilla cream.", tags: ["vegetarian"], modifiers: [{ name: "Brownie extras", options: ["Vanilla cream", "Chocolate sauce"] }] },
  { id: "lemon-iced-tea", name: "Lemon Iced Tea", category: "Beverages", price: 149, description: "Brewed tea, fresh lemon, and a touch of sweetness.", tags: ["vegan"], variant: ["Regular", "Large"] },
  { id: "masala-chai", name: "Masala Chai", category: "Beverages", price: 99, description: "Black tea simmered with milk and warming spices.", tags: ["vegetarian"] },
  { id: "espresso", name: "Espresso", category: "Beverages", price: 119, description: "A short, rich double shot of house espresso.", tags: ["vegan"] },
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function seed() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required. Set it in menu-service/.env or the environment.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const categoryByName = new Map();
  for (const [index, [name, description]] of categorySeeds.entries()) {
    const category = await Category.findOneAndUpdate(
      { restaurantId, name },
      { $set: { description, displayPriority: index, isActive: true } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    categoryByName.set(name, String(category._id));
  }

  for (const [name, category, description] of ingredientSeeds) {
    await Ingredient.findOneAndUpdate(
      { restaurantId, name },
      { $set: { category, description, isActive: true } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  for (const [code, name, description] of allergenSeeds) {
    await Allergen.findOneAndUpdate(
      { code },
      { $set: { name, description, isActive: true } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  let variantCount = 0;
  let modifierGroupCount = 0;
  for (const [index, item] of products.entries()) {
    const productId = `seed_${item.id}`;
    const variantIds = [];
    const modifierGroupIds = [];

    if (item.variant) {
      const variantId = `seed_variant_${item.id}_size`;
      variantIds.push(variantId);
      await Variant.findOneAndUpdate(
        { _id: variantId },
        {
          $set: {
            restaurantId,
            productId,
            name: "Size",
            isActive: true,
            options: item.variant.map((name, optionIndex) => ({
              optionId: `${slug(item.id)}-${slug(name)}`,
              name,
              priceAdjustment: optionIndex === 0 ? 0 : 100,
              isAvailable: true,
              displayPriority: optionIndex,
            })),
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      variantCount += 1;
    }

    for (const [modifierIndex, modifier] of (item.modifiers || []).entries()) {
      const modifierId = `seed_modifier_${item.id}_${slug(modifier.name)}`;
      modifierGroupIds.push(modifierId);
      await ModifierGroup.findOneAndUpdate(
        { _id: modifierId },
        {
          $set: {
            restaurantId,
            productId,
            name: modifier.name,
            required: false,
            minimumSelection: 0,
            maximumSelection: 1,
            isActive: true,
            options: modifier.options.map((name, optionIndex) => ({
              optionId: `${slug(item.id)}-${modifierIndex}-${slug(name)}`,
              name,
              priceAdjustment: optionIndex === 0 ? 0 : 50,
              isAvailable: true,
              displayPriority: optionIndex,
            })),
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      modifierGroupCount += 1;
    }

    await Product.findOneAndUpdate(
      { _id: productId },
      {
        $set: {
          restaurantId,
          categoryId: categoryByName.get(item.category),
          name: item.name,
          description: item.description,
          basePrice: item.price,
          isAvailable: true,
          status: "ACTIVE",
          dietaryTags: item.tags,
          variantIds,
          modifierGroupIds,
          displayPriority: index,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Seeded restaurant ${restaurantId}:`);
  console.log(`  ${categorySeeds.length} categories`);
  console.log(`  ${products.length} products`);
  console.log(`  ${variantCount} variants linked to products`);
  console.log(`  ${modifierGroupCount} modifier groups linked to products`);
  console.log(`  ${ingredientSeeds.length} ingredients`);
  console.log(`  ${allergenSeeds.length} allergens`);
  console.log("Seed is repeatable; matching records are updated instead of duplicated.");
}

seed()
  .catch((error) => {
    console.error("Menu seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
