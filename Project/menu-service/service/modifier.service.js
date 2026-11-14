const ModifierGroup = require("../models/modifier.model");
const Product = require("../models/products.model");

const createModifierGroup = async (data) => {
  try {
    const product = await Product.findOne({
      _id: data.productId,
      restaurantId: data.restaurantId,
    });
    if (!product) throw new Error("Product does not belong to this restaurant");
    return await ModifierGroup.create(data);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "A modifier group with this name already exists for this product"
      );
    }

    throw error;
  }
};

const getModifierGroups = async (filters = {}) => {
  return await ModifierGroup.find(filters).sort({
    createdAt: -1,
  });
};

const getModifierGroupById = async (id, restaurantId) => {
  return restaurantId
    ? await ModifierGroup.findOne({ _id: id, restaurantId })
    : await ModifierGroup.findById(id);
};

const updateModifierGroup = async (id, data, restaurantId) => {
  try {
    if (restaurantId) {
      const current = await ModifierGroup.findOne({ _id: id, restaurantId });
      if (!current) return null;
      if (data.restaurantId !== restaurantId) {
        throw new Error("Modifier group restaurant cannot be changed");
      }
      const product = await Product.findOne({ _id: data.productId || current.productId, restaurantId });
      if (!product) throw new Error("Product does not belong to this restaurant");
    }
    return await ModifierGroup.findOneAndUpdate(
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
        "A modifier group with this name already exists for this product"
      );
    }

    throw error;
  }
};

const deleteModifierGroup = async (id, restaurantId) => {
  return await ModifierGroup.findOneAndDelete(
    restaurantId ? { _id: id, restaurantId } : { _id: id }
  );
};

module.exports = {
  createModifierGroup,
  getModifierGroups,
  getModifierGroupById,
  updateModifierGroup,
  deleteModifierGroup,
};