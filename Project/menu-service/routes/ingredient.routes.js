const express = require("express");

const {
  createIngredient,
  getIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient,
} = require("../service/ingredient.service");

const router = express.Router();

/**
 * @swagger
 * /api/v1/menu/ingredients:
 *   post:
 *     summary: Create an ingredient
 *     tags:
 *       - Ingredients
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Ingredient'
 *     responses:
 *       201:
 *         description: Ingredient created successfully
 *       400:
 *         description: Invalid ingredient
 */
router.post("/", async (req, res) => {
  try {
    const ingredient =
      await createIngredient(req.body);

    res.status(201).json({
      success: true,
      message:
        "Ingredient created successfully",
      data: ingredient,
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
 * /api/v1/menu/ingredients:
 *   get:
 *     summary: Get ingredients
 *     tags:
 *       - Ingredients
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Ingredients retrieved successfully
 */
router.get("/", async (req, res) => {
  try {
    const filters = {};

    if (req.query.restaurantId) {
      filters.restaurantId =
        req.query.restaurantId;
    }

    if (req.query.category) {
      filters.category =
        req.query.category.toUpperCase();
    }

    if (
      req.query.isActive !==
      undefined
    ) {
      filters.isActive =
        req.query.isActive === "true";
    }

    const ingredients =
      await getIngredients(filters);

    res.status(200).json({
      success: true,
      count: ingredients.length,
      data: ingredients,
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
 * /api/v1/menu/ingredients/{id}:
 *   get:
 *     summary: Get ingredient by ID
 *     tags:
 *       - Ingredients
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ingredient retrieved successfully
 *       404:
 *         description: Ingredient not found
 */
router.get("/:id", async (req, res) => {
  try {
    const ingredient =
      await getIngredientById(
        req.params.id
      );

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: "Ingredient not found",
      });
    }

    res.status(200).json({
      success: true,
      data: ingredient,
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
 * /api/v1/menu/ingredients/{id}:
 *   put:
 *     summary: Update an ingredient
 *     tags:
 *       - Ingredients
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
 *             $ref: '#/components/schemas/Ingredient'
 *     responses:
 *       200:
 *         description: Ingredient updated successfully
 *       404:
 *         description: Ingredient not found
 */
router.put("/:id", async (req, res) => {
  try {
    const ingredient =
      await updateIngredient(
        req.params.id,
        req.body
      );

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: "Ingredient not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Ingredient updated successfully",
      data: ingredient,
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
 * /api/v1/menu/ingredients/{id}:
 *   delete:
 *     summary: Delete an ingredient
 *     tags:
 *       - Ingredients
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ingredient deleted successfully
 *       404:
 *         description: Ingredient not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const ingredient =
      await deleteIngredient(
        req.params.id
      );

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: "Ingredient not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Ingredient deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;