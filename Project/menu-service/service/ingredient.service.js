const Ingredient = require("../models/ingrediants.model");

const createIngredient = async (data) => {
  try {
    return await Ingredient.create(data);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "An ingredient with this name already exists"
      );
    }

    throw error;
  }
};

const getIngredients = async (filters = {}) => {
  return await Ingredient.find(filters).sort({
    name: 1,
  });
};

const getIngredientById = async (id) => {
  return await Ingredient.findById(id);
};

const updateIngredient = async (id, data) => {
  try {
    return await Ingredient.findByIdAndUpdate(
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
        "An ingredient with this name already exists"
      );
    }

    throw error;
  }
};

const deleteIngredient = async (id) => {
  return await Ingredient.findByIdAndDelete(id);
};

module.exports = {
  createIngredient,
  getIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient,
};