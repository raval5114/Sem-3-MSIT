const ModifierGroup = require("../models/modifier.model");

const createModifierGroup = async (data) => {
  try {
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

const getModifierGroupById = async (id) => {
  return await ModifierGroup.findById(id);
};

const updateModifierGroup = async (id, data) => {
  try {
    return await ModifierGroup.findByIdAndUpdate(
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
        "A modifier group with this name already exists for this product"
      );
    }

    throw error;
  }
};

const deleteModifierGroup = async (id) => {
  return await ModifierGroup.findByIdAndDelete(id);
};

module.exports = {
  createModifierGroup,
  getModifierGroups,
  getModifierGroupById,
  updateModifierGroup,
  deleteModifierGroup,
};