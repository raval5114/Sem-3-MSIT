    const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",

    info: {
      title: "DineFlow Menu & Catalog Service API",
      version: "1.0.0",
      description:
        "API documentation for the DineFlow Menu & Catalog Microservice.",
    },

    servers: [
      {
        url: "http://localhost:3001",
        description: "Local Development Server",
      },
    ],

    tags: [
      {
        name: "Categories",
        description: "Restaurant menu category APIs",
      },
      {
        name: "Products",
        description: "Menu product APIs",
      },
      {
        name: "Variants",
        description: "Product variant APIs",
      },
      {
        name: "Modifier Groups",
        description:
          "Product modifier group and option APIs",
      },
      {
        name: "Ingredients",
        description: "Ingredient master APIs",
      },
      {
        name: "Allergens",
        description: "Allergen master APIs",
      },
      {
        name: "Health",
        description: "Service health APIs",
      },
    ],

    components: {
      schemas: {
        /*
        |--------------------------------------------------------------------------
        | Category
        |--------------------------------------------------------------------------
        */

        Category: {
          type: "object",
          required: [
            "_id",
            "restaurantId",
            "name",
          ],
          properties: {
            _id: {
              type: "string",
              example: "category_pizza",
            },

            restaurantId: {
              type: "string",
              example: "restaurant_001",
            },

            name: {
              type: "string",
              example: "Pizzas",
            },

            description: {
              type: "string",
              example:
                "Freshly prepared pizzas",
            },

            displayPriority: {
              type: "integer",
              example: 1,
            },

            isActive: {
              type: "boolean",
              example: true,
            },
          },
        },

        /*
        |--------------------------------------------------------------------------
        | Product
        |--------------------------------------------------------------------------
        */

        Product: {
          type: "object",
          required: [
            "restaurantId",
            "categoryId",
            "name",
            "basePrice",
          ],
          properties: {
            _id: {
              type: "string",
              example: "food_001",
            },

            restaurantId: {
              type: "string",
              example: "restaurant_001",
            },

            categoryId: {
              type: "string",
              example: "category_pizza",
            },

            name: {
              type: "string",
              example: "Paneer Pizza",
            },

            description: {
              type: "string",
              example:
                "Pizza topped with paneer and mozzarella",
            },

            basePrice: {
              type: "number",
              format: "float",
              example: 299,
            },

            isAvailable: {
              type: "boolean",
              example: true,
            },

            status: {
              type: "string",
              enum: [
                "ACTIVE",
                "INACTIVE",
                "ARCHIVED",
              ],
              example: "ACTIVE",
            },

            dietaryTags: {
              type: "array",
              items: {
                type: "string",
              },
              example: ["VEGETARIAN"],
            },

            spiceLevel: {
              type: "integer",
              minimum: 0,
              maximum: 5,
              example: 2,
            },

            imageUrl: {
              type: "string",
              example:
                "/images/paneer-pizza.jpg",
            },

            preparationTimeMinutes: {
              type: "integer",
              example: 20,
            },

            variantIds: {
              type: "array",
              items: {
                type: "string",
              },
              example: [
                "variant_pizza_size_001",
              ],
            },

            modifierGroupIds: {
              type: "array",
              items: {
                type: "string",
              },
              example: [
                "modifier_toppings_001",
              ],
            },

            recipeId: {
              type: "string",
              nullable: true,
              example:
                "recipe_paneer_pizza_v1",
            },

            displayPriority: {
              type: "integer",
              example: 1,
            },

            createdAt: {
              type: "string",
              format: "date-time",
            },

            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },

        /*
        |--------------------------------------------------------------------------
        | Variant
        |--------------------------------------------------------------------------
        */

        VariantOption: {
          type: "object",
          required: [
            "optionId",
            "name",
          ],
          properties: {
            optionId: {
              type: "string",
              example: "size_small",
            },

            name: {
              type: "string",
              example: "Small",
            },

            priceAdjustment: {
              type: "number",
              example: 0,
            },

            isAvailable: {
              type: "boolean",
              example: true,
            },

            displayPriority: {
              type: "integer",
              example: 1,
            },
          },
        },

        Variant: {
          type: "object",
          required: [
            "restaurantId",
            "productId",
            "name",
            "options",
          ],
          properties: {
            _id: {
              type: "string",
              example:
                "variant_pizza_size_001",
            },

            restaurantId: {
              type: "string",
              example: "restaurant_001",
            },

            productId: {
              type: "string",
              example: "food_001",
            },

            name: {
              type: "string",
              example: "Size",
            },

            options: {
              type: "array",
              items: {
                $ref: "#/components/schemas/VariantOption",
              },
            },

            isActive: {
              type: "boolean",
              example: true,
            },
          },
        },

        /*
        |--------------------------------------------------------------------------
        | Modifier Group
        |--------------------------------------------------------------------------
        */

        ModifierOption: {
          type: "object",
          required: [
            "optionId",
            "name",
          ],
          properties: {
            optionId: {
              type: "string",
              example: "topping_cheese",
            },

            name: {
              type: "string",
              example: "Extra Cheese",
            },

            priceAdjustment: {
              type: "number",
              example: 40,
            },

            isAvailable: {
              type: "boolean",
              example: true,
            },

            displayPriority: {
              type: "integer",
              example: 1,
            },
          },
        },

        ModifierGroup: {
          type: "object",
          required: [
            "restaurantId",
            "productId",
            "name",
            "options",
          ],
          properties: {
            _id: {
              type: "string",
              example:
                "modifier_toppings_001",
            },

            restaurantId: {
              type: "string",
              example: "restaurant_001",
            },

            productId: {
              type: "string",
              example: "food_001",
            },

            name: {
              type: "string",
              example: "Extra Toppings",
            },

            required: {
              type: "boolean",
              example: false,
            },

            minimumSelection: {
              type: "integer",
              example: 0,
            },

            maximumSelection: {
              type: "integer",
              example: 3,
            },

            options: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ModifierOption",
              },
            },

            isActive: {
              type: "boolean",
              example: true,
            },
          },
        },

        /*
        |--------------------------------------------------------------------------
        | Ingredient
        |--------------------------------------------------------------------------
        */

        Ingredient: {
          type: "object",
          required: [
            "restaurantId",
            "name",
            "category",
          ],
          properties: {
            _id: {
              type: "string",
              example: "ingredient_paneer",
            },

            restaurantId: {
              type: "string",
              example: "restaurant_001",
            },

            name: {
              type: "string",
              example: "Paneer",
            },

            category: {
              type: "string",
              example: "DAIRY",
            },

            description: {
              type: "string",
              example:
                "Indian cottage cheese",
            },

            isActive: {
              type: "boolean",
              example: true,
            },
          },
        },

        /*
        |--------------------------------------------------------------------------
        | Allergen
        |--------------------------------------------------------------------------
        */

        Allergen: {
          type: "object",
          required: [
            "code",
            "name",
          ],
          properties: {
            _id: {
              type: "string",
              example: "allergen_milk",
            },

            code: {
              type: "string",
              example: "MILK",
            },

            name: {
              type: "string",
              example: "Milk",
            },

            description: {
              type: "string",
              example:
                "Milk and milk-derived ingredients",
            },

            isActive: {
              type: "boolean",
              example: true,
            },
          },
        },

        /*
        |--------------------------------------------------------------------------
        | Generic API Response
        |--------------------------------------------------------------------------
        */

        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },

            message: {
              type: "string",
              example:
                "Resource not found",
            },
          },
        },
      },
    },
  },

  apis: [
    "./routes/*.routes.js",
  ],
};

const swaggerSpec =
  swaggerJSDoc(options);

module.exports = swaggerSpec;
