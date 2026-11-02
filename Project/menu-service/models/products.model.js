const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Example: food_001
    _id: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    //Hari Rawal
    // Restaurant that owns this product
    restaurantId: {
      type: String,
      required: true,
      index: true,
    },

    // Parent category
    // Example: category_pizza
    categoryId: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "ACTIVE",
    },

    dietaryTags: {
      type: [String],
      default: [],
    },

    spiceLevel: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    imageUrl: {
      type: String,
      default: "",
    },

    preparationTimeMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    /*
     * References to Variant documents.
     *
     * Example:
     * [
     *   "variant_pizza_size_001"
     * ]
     */
    variantIds: {
      type: [String],
      default: [],
    },

    /*
     * References to ModifierGroup documents.
     *
     * Example:
     * [
     *   "modifier_toppings_001"
     * ]
     */
    modifierGroupIds: {
      type: [String],
      default: [],
    },

    /*
     * Recipe is the source of truth
     * for ingredient composition.
     */
    recipeId: {
      type: String,
      default: null,
    },

    displayPriority: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Prevent duplicate product names
 * inside the same restaurant/category.
 */
productSchema.index(
  {
    restaurantId: 1,
    categoryId: 1,
    name: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "Product",
  productSchema
);
