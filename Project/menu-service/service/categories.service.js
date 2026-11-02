const Category = require("../models/categories.model");
// Create Category
const createCategory = async (categoryData) => {
  try {
    const category = await Category.create(categoryData);

    return category;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "Category with this name already exists for this restaurant"
      );
    }

    throw error;
  }
};

// Get all Categories
const getCategories = async (filters = {}) => {
  try {
    const categories = await Category.find(filters)
      .sort({ displayPriority: 1, createdAt: 1 });

    return categories;
  } catch (error) {
    throw error;
  }
};

// Get Category by ID
const getCategoryById = async (id) => {
  try {
    const category = await Category.findById(id);

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  } catch (error) {
    throw error;
  }
};

// Update Category
const updateCategory = async (id, updateData) => {
  try {
    const category = await Category.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "Category with this name already exists for this restaurant"
      );
    }

    throw error;
  }
};

// Delete Category
const deleteCategory = async (id) => {
  try {
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};