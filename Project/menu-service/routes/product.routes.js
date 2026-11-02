const express = require("express");

const {
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
} = require("../service/product.service");

const router = express.Router();

/**
 * @swagger
 * /api/v1/menu/products:
 *   post:
 *     summary: Create a menu product
 *     tags:
 *       - Products
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Invalid product data
 */
router.post("/", async (req, res) => {
  try {
    const product =
      await createProduct(req.body);

    res.status(201).json({
      success: true,
      message:
        "Product created successfully",
      data: product,
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
 * /api/v1/menu/products:
 *   get:
 *     summary: Get products
 *     tags:
 *       - Products
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ARCHIVED]
 *       - in: query
 *         name: isAvailable
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get("/", async (req, res) => {
  try {
    const filters = {};

    if (req.query.restaurantId) {
      filters.restaurantId =
        req.query.restaurantId;
    }

    if (req.query.categoryId) {
      filters.categoryId =
        req.query.categoryId;
    }

    if (req.query.status) {
      filters.status =
        req.query.status;
    }

    if (
      req.query.isAvailable !==
      undefined
    ) {
      filters.isAvailable =
        req.query.isAvailable ===
        "true";
    }

    const products =
      await getProducts(filters);

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
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
 * /api/v1/menu/products/{id}/details:
 *   get:
 *     summary: Get complete product details
 *     description: Returns product, category, variants and modifier groups.
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Complete product details
 *       404:
 *         description: Product not found
 */
router.get(
  "/:id/details",
  async (req, res) => {
    try {
      const product =
        await getProductDetails(
          req.params.id
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/menu/products/{id}/variants:
 *   get:
 *     summary: Get variants belonging to a product
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product variants retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get(
  "/:id/variants",
  async (req, res) => {
    try {
      const variants =
        await getProductVariants(
          req.params.id
        );

      if (variants === null) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        productId: req.params.id,
        count: variants.length,
        data: variants,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/menu/products/{id}/modifier-groups:
 *   get:
 *     summary: Get modifier groups belonging to a product
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Modifier groups retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get(
  "/:id/modifier-groups",
  async (req, res) => {
    try {
      const modifierGroups =
        await getProductModifierGroups(
          req.params.id
        );

      if (modifierGroups === null) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        productId: req.params.id,
        count: modifierGroups.length,
        data: modifierGroups,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/menu/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get("/:id", async (req, res) => {
  try {
    const product =
      await getProductById(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
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
 * /api/v1/menu/products/{id}:
 *   put:
 *     summary: Update a product
 *     tags:
 *       - Products
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
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Invalid product data
 *       404:
 *         description: Product not found
 */
router.put("/:id", async (req, res) => {
  try {
    const product =
      await updateProduct(
        req.params.id,
        req.body
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      data: product,
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
 * /api/v1/menu/products/{id}/availability:
 *   patch:
 *     summary: Update product availability
 *     tags:
 *       - Products
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
 *             type: object
 *             required:
 *               - isAvailable
 *             properties:
 *               isAvailable:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Availability updated
 *       404:
 *         description: Product not found
 */
router.patch(
  "/:id/availability",
  async (req, res) => {
    try {
      if (
        typeof req.body.isAvailable !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "isAvailable must be a boolean",
        });
      }

      const product =
        await updateAvailability(
          req.params.id,
          req.body.isAvailable
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Product availability updated successfully",
        data: product,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/menu/products/{id}/status:
 *   patch:
 *     summary: Update product status
 *     tags:
 *       - Products
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
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - ACTIVE
 *                   - INACTIVE
 *                   - ARCHIVED
 *                 example: ACTIVE
 *     responses:
 *       200:
 *         description: Status updated
 *       404:
 *         description: Product not found
 */
router.patch(
  "/:id/status",
  async (req, res) => {
    try {
      const allowedStatuses = [
        "ACTIVE",
        "INACTIVE",
        "ARCHIVED",
      ];

      if (
        !allowedStatuses.includes(
          req.body.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product status",
        });
      }

      const product =
        await updateStatus(
          req.params.id,
          req.body.status
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Product status updated successfully",
        data: product,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/menu/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */
router.delete(
  "/:id",
  async (req, res) => {
    try {
      const product =
        await deleteProduct(
          req.params.id
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Product deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;