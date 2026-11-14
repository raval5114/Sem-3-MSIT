const Category = require("../models/categories.model");
const Product = require("../models/products.model");
const Variant = require("../models/variants.model");
const ModifierGroup = require("../models/modifier.model");

async function getCustomerCatalog(restaurantId, models = { Category, Product, Variant, ModifierGroup }) {
  const categories = await models.Category.find({ restaurantId, isActive: true })
    .sort({ displayPriority: 1, createdAt: 1 }).lean();
  if (!categories.length) return [];

  const products = await models.Product.find({
    restaurantId,
    categoryId: { $in: categories.map((category) => String(category._id)) },
    status: "ACTIVE",
    isAvailable: true,
  }).sort({ displayPriority: 1, createdAt: -1 }).lean();
  const productIds = products.map((product) => product._id);
  const [variants, modifierGroups] = productIds.length ? await Promise.all([
    models.Variant.find({ restaurantId, productId: { $in: productIds }, isActive: true }).lean(),
    models.ModifierGroup.find({ restaurantId, productId: { $in: productIds }, isActive: true }).lean(),
  ]) : [[], []];

  return categories.map((category) => ({
    ...category,
    products: products.filter((product) => product.categoryId === String(category._id)).map((product) => ({
      ...product,
      variants: variants.filter((variant) => variant.productId === product._id),
      modifierGroups: modifierGroups.filter((group) => group.productId === product._id),
    })),
  }));
}

async function getCustomerProductDetails(restaurantId, productId, models = { Category, Product, Variant, ModifierGroup }) {
  const product = await models.Product.findOne({
    _id: productId,
    restaurantId,
    status: "ACTIVE",
    isAvailable: true,
  }).lean();
  if (!product) return null;

  const category = await models.Category.findOne({
    _id: product.categoryId,
    restaurantId,
    isActive: true,
  }).lean();
  if (!category) return null;

  const [variants, modifierGroups] = await Promise.all([
    models.Variant.find({ restaurantId, productId: product._id, isActive: true }).lean(),
    models.ModifierGroup.find({ restaurantId, productId: product._id, isActive: true }).lean(),
  ]);
  return { ...product, category, variants, modifierGroups };
}

module.exports = { getCustomerCatalog, getCustomerProductDetails };
