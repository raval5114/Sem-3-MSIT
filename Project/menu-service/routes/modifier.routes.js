const express = require("express");

const {
  createModifierGroup,
  getModifierGroups,
  getModifierGroupById,
  updateModifierGroup,
  deleteModifierGroup,
} = require("../service/modifier.service");

const router = express.Router();

/**
 * @swagger
 * /api/v1/menu/modifier-groups:
 *   post:
 *     summary: Create a modifier group
 *     tags:
 *       - Modifier Groups
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModifierGroup'
 *     responses:
 *       201:
 *         description: Modifier group created successfully
 *       400:
 *         description: Invalid modifier group
 */
router.post("/", async (req, res) => {
  try {
    const modifierGroup =
      await createModifierGroup(
        req.body
      );

    res.status(201).json({
      success: true,
      message:
        "Modifier group created successfully",
      data: modifierGroup,
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
 * /api/v1/menu/modifier-groups:
 *   get:
 *     summary: Get modifier groups
 *     tags:
 *       - Modifier Groups
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
 *         description: Modifier groups retrieved successfully
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

    const modifierGroups =
      await getModifierGroups(filters);

    res.status(200).json({
      success: true,
      count: modifierGroups.length,
      data: modifierGroups,
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
 * /api/v1/menu/modifier-groups/{id}:
 *   get:
 *     summary: Get modifier group by ID
 *     tags:
 *       - Modifier Groups
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Modifier group retrieved successfully
 *       404:
 *         description: Modifier group not found
 */
router.get("/:id", async (req, res) => {
  try {
    const modifierGroup =
      await getModifierGroupById(
        req.params.id
      );

    if (!modifierGroup) {
      return res.status(404).json({
        success: false,
        message:
          "Modifier group not found",
      });
    }

    res.status(200).json({
      success: true,
      data: modifierGroup,
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
 * /api/v1/menu/modifier-groups/{id}:
 *   put:
 *     summary: Update a modifier group
 *     tags:
 *       - Modifier Groups
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
 *             $ref: '#/components/schemas/ModifierGroup'
 *     responses:
 *       200:
 *         description: Modifier group updated successfully
 *       404:
 *         description: Modifier group not found
 */
router.put("/:id", async (req, res) => {
  try {
    const modifierGroup =
      await updateModifierGroup(
        req.params.id,
        req.body
      );

    if (!modifierGroup) {
      return res.status(404).json({
        success: false,
        message:
          "Modifier group not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Modifier group updated successfully",
      data: modifierGroup,
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
 * /api/v1/menu/modifier-groups/{id}:
 *   delete:
 *     summary: Delete a modifier group
 *     tags:
 *       - Modifier Groups
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Modifier group deleted successfully
 *       404:
 *         description: Modifier group not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const modifierGroup =
      await deleteModifierGroup(
        req.params.id
      );

    if (!modifierGroup) {
      return res.status(404).json({
        success: false,
        message:
          "Modifier group not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Modifier group deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;