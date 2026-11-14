const express = require("express");
const { getCustomerCatalog, getCustomerProductDetails } = require("../service/customer-catalog.service");

const router = express.Router();

router.get("/:restaurantId", async (req, res) => {
  if (!req.params.restaurantId || req.params.restaurantId.length > 128) {
    return res.status(400).json({ success: false, message: "A valid restaurantId is required" });
  }
  try {
    const categories = await getCustomerCatalog(req.params.restaurantId);
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load the customer menu" });
  }
});

router.get("/:restaurantId/products/:productId", async (req, res) => {
  const { restaurantId, productId } = req.params;
  if (!restaurantId || restaurantId.length > 128 || !productId || productId.length > 128) {
    return res.status(400).json({ success: false, message: "A valid restaurantId and productId are required" });
  }
  try {
    const product = await getCustomerProductDetails(restaurantId, productId);
    if (!product) return res.status(404).json({ success: false, message: "Menu item is unavailable" });
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load menu item details" });
  }
});

module.exports = router;
