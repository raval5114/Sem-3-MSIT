const express = require("express");
const { getCustomerCatalog } = require("../service/customer-catalog.service");

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

module.exports = router;
