const mongoose = require("mongoose");

const modifierOptionSchema = new mongoose.Schema(
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

const modifierGroupSchema = new mongoose.Schema(
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

    required: {
      type: Boolean,
      default: false,
    },

    minimumSelection: {
      type: Number,
      default: 0,
      min: 0,
    },

    maximumSelection: {
      type: Number,
      default: 1,
      min: 1,
    },

    options: {
      type: [modifierOptionSchema],
      required: true,
      validate: {
        validator: (options) => options.length > 0,
        message: "Modifier group must have at least one option",
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

modifierGroupSchema.pre("validate", function (next) {
  if (this.minimumSelection > this.maximumSelection) {
    return next(
      new Error(
        "minimumSelection cannot be greater than maximumSelection"
      )
    );
  }

  if (this.maximumSelection > this.options.length) {
    return next(
      new Error(
        "maximumSelection cannot exceed the number of options"
      )
    );
  }

  if (this.required && this.minimumSelection < 1) {
    this.minimumSelection = 1;
  }

  next();
});

modifierGroupSchema.index(
  { productId: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ModifierGroup",
  modifierGroupSchema
);
