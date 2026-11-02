const mongoose = require("mongoose");

const variantOptionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    priceAdjustment: {
      type: Number,
      default: 0,
      min: 0,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    displayPriority: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    restaurantId: {
      type: String,
      required: true,
      index: true,
    },

    productId: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    options: {
      type: [variantOptionSchema],
      required: true,
      validate: {
        validator: (options) => options.length > 0,
        message: "Variant must have at least one option",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

variantSchema.index(
  { productId: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model("Variant", variantSchema);
