const Variant = require("../models/variants.model");

const createVariant = async (data) => {
  try {
    return await Variant.create(data);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "A variant with this name already exists for this product"
      );
    }

    throw error;
  }
};

const getVariants = async (filters = {}) => {
  return await Variant.find(filters).sort({
    createdAt: -1,
  });
};

const getVariantById = async (id) => {
  return await Variant.findById(id);
};

const updateVariant = async (id, data) => {
  try {
    return await Variant.findByIdAndUpdate(
      id,
      data,
      {
        new: true,
        runValidators: true,
      }
    );
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "A variant with this name already exists for this product"
      );
    }

    throw error;
  }
};

const deleteVariant = async (id) => {
  return await Variant.findByIdAndDelete(id);
};

module.exports = {
  createVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
};