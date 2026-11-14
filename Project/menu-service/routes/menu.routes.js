const express = require("express");
const { searchMenu } = require("../service/menu.service");

const router = express.Router();

/**
 * Menu Search & Filtering Endpoint
 * Dual-interface REST counterpart to MCP tool 'search_menu'
 * Supports query params or JSON body
 */
const searchHandler = async (req, res) => {
  try {
    const params = {
      query: req.query.q || req.query.query || req.body?.query,
      categoryId: req.query.categoryId || req.body?.categoryId,
      minPrice: req.query.minPrice || req.body?.minPrice,
      maxPrice: req.query.maxPrice || req.body?.maxPrice,
      dietaryTags: req.query.dietary || req.query.diet || req.body?.dietaryTags,
      excludeAllergens:
        req.query.excludeAllergens ||
        req.query.excludeAllergen ||
        req.body?.excludeAllergens,
      restaurantId: req.query.restaurantId || req.body?.restaurantId,
      isAvailable:
        req.query.isAvailable !== undefined
          ? req.query.isAvailable === "true"
          : req.body?.isAvailable,
      status: req.query.status || req.body?.status || "ACTIVE",
    };

    const results = await searchMenu(params);

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Menu search failed",
    });
  }
};

router.get("/", searchHandler);
router.post("/", searchHandler);

module.exports = router;
