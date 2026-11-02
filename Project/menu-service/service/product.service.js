const Product = require("../models/products.model");
const Category = require("../models/categories.model");
const Variant = require("../models/variants.model");
const ModifierGroup = require("../models/modifier.model");

/*
|--------------------------------------------------------------------------
| Validation Helpers
|--------------------------------------------------------------------------
*/

const validateCategory = async (
  categoryId,
  restaurantId,
  { requireActive = true } = {}
) => {
  const category = await Category.findOne({
    _id: categoryId,
    restaurantId,
  });

  if (!category) {
    throw new Error(
      "Category does not exist for this restaurant"
    );
  }

  if (requireActive && !category.isActive) {
    throw new Error(
      "Category is inactive and cannot be assigned to a product"
    );
  }

  return category;
};

const validateVariants = async (
  variantIds,
  productId,
  restaurantId
) => {
  if (!variantIds || variantIds.length === 0) {
    return;
  }

  const variants = await Variant.find({
    _id: {
      $in: variantIds,
    },
  });

  if (variants.length !== variantIds.length) {
    throw new Error(
      "One or more variant IDs are invalid"
    );
  }

  const invalidVariant = variants.find(
    (variant) =>
      variant.productId !== productId ||
      variant.restaurantId !== restaurantId
  );

  if (invalidVariant) {
    throw new Error(
      "One or more variants do not belong to this product"
    );
  }
};

const validateModifierGroups = async (
  modifierGroupIds,
  productId,
  restaurantId
) => {
  if (
    !modifierGroupIds ||
    modifierGroupIds.length === 0
  ) {
    return;
  }

  const modifierGroups =
    await ModifierGroup.find({
      _id: {
        $in: modifierGroupIds,
      },
    });

  if (
    modifierGroups.length !==
    modifierGroupIds.length
  ) {
    throw new Error(
      "One or more modifier group IDs are invalid"
    );
  }

  const invalidModifierGroup =
    modifierGroups.find(
      (group) =>
        group.productId !== productId ||
        group.restaurantId !== restaurantId
    );

  if (invalidModifierGroup) {
    throw new Error(
      "One or more modifier groups do not belong to this product"
    );
  }
};

/*
|--------------------------------------------------------------------------
| Create Product
|--------------------------------------------------------------------------
*/

const createProduct = async (data) => {
  try {
    /*
     * Category must already exist.
     */
    await validateCategory(
      data.categoryId,
      data.restaurantId
    );

    /*
     * A product is created BEFORE its variants
     * and modifier groups because those child
     * documents reference productId.
     */
    if (data.variantIds?.length > 0) {
      throw new Error(
        "Create the product first, then attach variants using the update API"
      );
    }

    if (data.modifierGroupIds?.length > 0) {
      throw new Error(
        "Create the product first, then attach modifier groups using the update API"
      );
    }

    const product = await Product.create(data);

    return product;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "A product with this name already exists in this category"
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Get Products
|--------------------------------------------------------------------------
*/

const getProducts = async (filters = {}) => {
  return await Product.find(filters).sort({
    displayPriority: 1,
    createdAt: -1,
  });
};

/*
|--------------------------------------------------------------------------
| Get Product By ID
|--------------------------------------------------------------------------
*/

const getProductById = async (id) => {
  return await Product.findById(id);
};

/*
|--------------------------------------------------------------------------
| Get Complete Product Details
|--------------------------------------------------------------------------
*/

const getProductDetails = async (productId) => {
  const product =
    await Product.findById(productId).lean();

  if (!product) {
    return null;
  }

  const [
    category,
    variants,
    modifierGroups,
  ] = await Promise.all([
    Category.findById(
      product.categoryId
    ).lean(),

    Variant.find({
      _id: {
        $in: product.variantIds || [],
      },
      isActive: true,
    })
      .sort({
        createdAt: 1,
      })
      .lean(),

    ModifierGroup.find({
      _id: {
        $in: product.modifierGroupIds || [],
      },
      isActive: true,
    })
      .sort({
        createdAt: 1,
      })
      .lean(),
  ]);

  return {
    ...product,

    category: category || null,

    variants,

    modifierGroups,

    /*
     * Recipe API will be connected here
     * once Recipe model/service is implemented.
     */
    recipeId: product.recipeId || null,
  };
};

/*
|--------------------------------------------------------------------------
| Get Product Variants
|--------------------------------------------------------------------------
*/

const getProductVariants = async (
  productId
) => {
  const product =
    await Product.findById(productId).lean();

  if (!product) {
    return null;
  }

  const variants = await Variant.find({
    _id: {
      $in: product.variantIds || [],
    },
    isActive: true,
  }).sort({
    createdAt: 1,
  });

  return variants;
};

/*
|--------------------------------------------------------------------------
| Get Product Modifier Groups
|--------------------------------------------------------------------------
*/

const getProductModifierGroups = async (
  productId
) => {
  const product =
    await Product.findById(productId).lean();

  if (!product) {
    return null;
  }

  const modifierGroups =
    await ModifierGroup.find({
      _id: {
        $in: product.modifierGroupIds || [],
      },
      isActive: true,
    }).sort({
      createdAt: 1,
    });

  return modifierGroups;
};

/*
|--------------------------------------------------------------------------
| Update Product
|--------------------------------------------------------------------------
*/

const updateProduct = async (
  id,
  data
) => {
  try {
    const existingProduct =
      await Product.findById(id);

    if (!existingProduct) {
      return null;
    }

    /*
     * restaurantId should not normally change.
     */
    if (
      data.restaurantId &&
      data.restaurantId !==
        existingProduct.restaurantId
    ) {
      throw new Error(
        "Product restaurant cannot be changed"
      );
    }

    const restaurantId =
      existingProduct.restaurantId;

    const categoryId =
      data.categoryId ||
      existingProduct.categoryId;

    const variantIds =
      data.variantIds ??
      existingProduct.variantIds;

    const modifierGroupIds =
      data.modifierGroupIds ??
      existingProduct.modifierGroupIds;

    /*
     * Validate category.
     */
    await validateCategory(
      categoryId,
      restaurantId,
      {
        // Editing other product fields should remain possible if its
        // category was later deactivated. A newly assigned category must
        // be active.
        requireActive: data.categoryId !== undefined,
      }
    );

    /*
     * Validate variants.
     */
    await validateVariants(
      variantIds,
      id,
      restaurantId
    );

    /*
     * Validate modifier groups.
     */
    await validateModifierGroups(
      modifierGroupIds,
      id,
      restaurantId
    );

    return await Product.findByIdAndUpdate(
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
        "A product with this name already exists in this category"
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Delete Product
|--------------------------------------------------------------------------
*/

const deleteProduct = async (id) => {
  return await Product.findByIdAndDelete(id);
};

/*
|--------------------------------------------------------------------------
| Update Availability
|--------------------------------------------------------------------------
*/

const updateAvailability = async (
  id,
  isAvailable
) => {
  return await Product.findByIdAndUpdate(
    id,
    {
      isAvailable,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

/*
|--------------------------------------------------------------------------
| Update Status
|--------------------------------------------------------------------------
*/

const updateStatus = async (
  id,
  status
) => {
  return await Product.findByIdAndUpdate(
    id,
    {
      status,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getProductDetails,
  getProductVariants,
  getProductModifierGroups,
  updateProduct,
  deleteProduct,
  updateAvailability,
  updateStatus,
};
