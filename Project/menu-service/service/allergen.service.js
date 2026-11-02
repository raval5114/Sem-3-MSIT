const Allergen = require("../models/allergen.model");

const createAllergen = async (data) => {
  try {
    return await Allergen.create(data);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "An allergen with this code or name already exists"
      );
    }

    throw error;
  }
};

const getAllergens = async (filters = {}) => {
  return await Allergen.find(filters).sort({
    name: 1,
  });
};

const getAllergenById = async (id) => {
  return await Allergen.findById(id);
};

const updateAllergen = async (id, data) => {
  try {
    return await Allergen.findByIdAndUpdate(
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
        "An allergen with this code or name already exists"
      );
    }

    throw error;
  }
};

const deleteAllergen = async (id) => {
  return await Allergen.findByIdAndDelete(id);
};

module.exports = {
  createAllergen,
  getAllergens,
  getAllergenById,
  updateAllergen,
  deleteAllergen,
};