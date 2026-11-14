const Variant = require("../models/variants.model");
const Product = require("../models/products.model");

const createVariant = async (data) => {
  try {
    const product = await Product.findOne({
      _id: data.productId,
      restaurantId: data.restaurantId,
    });
    if (!product) throw new Error("Product does not belong to this restaurant");
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

const getVariantById = async (id, restaurantId) => {
  return restaurantId
    ? await Variant.findOne({ _id: id, restaurantId })
    : await Variant.findById(id);
};

const updateVariant = async (id, data, restaurantId) => {
  try {
    if (restaurantId) {
      const current = await Variant.findOne({ _id: id, restaurantId });
      if (!current) return null;
      if (data.restaurantId !== restaurantId) {
        throw new Error("Variant restaurant cannot be changed");
      }
      const product = await Product.findOne({ _id: data.productId || current.productId, restaurantId });
      if (!product) throw new Error("Product does not belong to this restaurant");
    }
    return await Variant.findOneAndUpdate(
      restaurantId ? { _id: id, restaurantId } : { _id: id },
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

const deleteVariant = async (id, restaurantId) => {
  return await Variant.findOneAndDelete(
    restaurantId ? { _id: id, restaurantId } : { _id: id }
  );
};

module.exports = {
  createVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
};