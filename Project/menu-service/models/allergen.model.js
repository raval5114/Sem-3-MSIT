const mongoose = require("mongoose");

const allergenSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
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

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

allergenSchema.index(
  { code: 1 },
  { unique: true }
);

allergenSchema.index(
  { name: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "Allergen",
  allergenSchema
);
