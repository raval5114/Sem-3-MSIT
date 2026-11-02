const express = require("express");

const {
  createVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
} = require("../service/variant.service");

const router = express.Router();

/**
 * @swagger
 * /api/v1/menu/variants:
 *   post:
 *     summary: Create a product variant
 *     tags:
 *       - Variants
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Variant'
 *     responses:
 *       201:
 *         description: Variant created successfully
 *       400:
 *         description: Invalid variant
 */
router.post("/", async (req, res) => {
  try {
    const variant =
      await createVariant(req.body);

    res.status(201).json({
      success: true,
      message:
        "Variant created successfully",
      data: variant,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/v1/menu/variants:
 *   get:
 *     summary: Get product variants
 *     tags:
 *       - Variants
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Variants retrieved successfully
 */
router.get("/", async (req, res) => {
  try {
    const filters = {};

    if (req.query.restaurantId) {
      filters.restaurantId =
        req.query.restaurantId;
    }

    if (req.query.productId) {
      filters.productId =
        req.query.productId;
    }

    if (
      req.query.isActive !==
      undefined
    ) {
      filters.isActive =
        req.query.isActive === "true";
    }

    const variants =
      await getVariants(filters);

    res.status(200).json({
      success: true,
      count: variants.length,
      data: variants,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/v1/menu/variants/{id}:
 *   get:
 *     summary: Get variant by ID
 *     tags:
 *       - Variants
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Variant retrieved successfully
 *       404:
 *         description: Variant not found
 */
router.get("/:id", async (req, res) => {
  try {
    const variant =
      await getVariantById(
        req.params.id
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    res.status(200).json({
      success: true,
      data: variant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/v1/menu/variants/{id}:
 *   put:
 *     summary: Update a variant
 *     tags:
 *       - Variants
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Variant'
 *     responses:
 *       200:
 *         description: Variant updated successfully
 *       404:
 *         description: Variant not found
 */
router.put("/:id", async (req, res) => {
  try {
    const variant =
      await updateVariant(
        req.params.id,
        req.body
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Variant updated successfully",
      data: variant,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/v1/menu/variants/{id}:
 *   delete:
 *     summary: Delete a variant
 *     tags:
 *       - Variants
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Variant deleted successfully
 *       404:
 *         description: Variant not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const variant =
      await deleteVariant(
        req.params.id
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Variant deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;