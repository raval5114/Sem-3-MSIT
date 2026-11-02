const express = require("express");

const {
  createAllergen,
  getAllergens,
  getAllergenById,
  updateAllergen,
  deleteAllergen,
} = require("../service/allergen.service");

const router = express.Router();

/**
 * @swagger
 * /api/v1/menu/allergens:
 *   post:
 *     summary: Create an allergen
 *     tags:
 *       - Allergens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Allergen'
 *     responses:
 *       201:
 *         description: Allergen created successfully
 *       400:
 *         description: Invalid allergen
 */
router.post("/", async (req, res) => {
  try {
    const allergen =
      await createAllergen(req.body);

    res.status(201).json({
      success: true,
      message:
        "Allergen created successfully",
      data: allergen,
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
 * /api/v1/menu/allergens:
 *   get:
 *     summary: Get allergens
 *     tags:
 *       - Allergens
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Allergens retrieved successfully
 */
router.get("/", async (req, res) => {
  try {
    const filters = {};

    if (
      req.query.isActive !==
      undefined
    ) {
      filters.isActive =
        req.query.isActive === "true";
    }

    const allergens =
      await getAllergens(filters);

    res.status(200).json({
      success: true,
      count: allergens.length,
      data: allergens,
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
 * /api/v1/menu/allergens/{id}:
 *   get:
 *     summary: Get allergen by ID
 *     tags:
 *       - Allergens
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Allergen retrieved successfully
 *       404:
 *         description: Allergen not found
 */
router.get("/:id", async (req, res) => {
  try {
    const allergen =
      await getAllergenById(
        req.params.id
      );

    if (!allergen) {
      return res.status(404).json({
        success: false,
        message: "Allergen not found",
      });
    }

    res.status(200).json({
      success: true,
      data: allergen,
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
 * /api/v1/menu/allergens/{id}:
 *   put:
 *     summary: Update an allergen
 *     tags:
 *       - Allergens
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
 *             $ref: '#/components/schemas/Allergen'
 *     responses:
 *       200:
 *         description: Allergen updated successfully
 *       404:
 *         description: Allergen not found
 */
router.put("/:id", async (req, res) => {
  try {
    const allergen =
      await updateAllergen(
        req.params.id,
        req.body
      );

    if (!allergen) {
      return res.status(404).json({
        success: false,
        message: "Allergen not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Allergen updated successfully",
      data: allergen,
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
 * /api/v1/menu/allergens/{id}:
 *   delete:
 *     summary: Delete an allergen
 *     tags:
 *       - Allergens
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Allergen deleted successfully
 *       404:
 *         description: Allergen not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const allergen =
      await deleteAllergen(
        req.params.id
      );

    if (!allergen) {
      return res.status(404).json({
        success: false,
        message: "Allergen not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Allergen deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;