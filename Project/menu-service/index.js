const express = require("express");
const cors = require("cors");

require("dotenv").config();

const connectDb = require("./config/db.config");
const pool = require("./config/pg.db.config");
const {
  connectRedis,
} = require("./config/redis.config");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger.config");

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

const categoryRoutes = require(
  "./routes/categories.routes"
);

const productRoutes = require(
  "./routes/product.routes"
);

const variantRoutes = require(
  "./routes/variant.routes"
);

const modifierGroupRoutes = require(
  "./routes/modifier.routes"
);

const ingredientRoutes = require(
  "./routes/ingredient.routes"
);

const allergenRoutes = require(
  "./routes/allergen.routes"
);
const customerCatalogRoutes = require(
  "./routes/customer-catalog.routes"
);

/*
|--------------------------------------------------------------------------
| App
|--------------------------------------------------------------------------
*/

const app = express();

const PORT =
  process.env.PORT || 3001;

/*
|--------------------------------------------------------------------------
| Global Middleware
|--------------------------------------------------------------------------
*/

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
  extended: true,
}));

/*
|--------------------------------------------------------------------------
| Swagger
|--------------------------------------------------------------------------
*/

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle:
      "DineFlow Menu Service API",
  })
);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/health", (req, res) => {
  res.status(200).json({
    service: "menu-service",
    status: "UP",
    timestamp:
      new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| Root
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.status(200).json({
    message:
      "Menu & Catalog Microservice is operational",

    version: "1.0.0",

    documentation:
      "/api-docs",

    endpoints: {
      categories:
        "/api/v1/menu/categories",

      products:
        "/api/v1/menu/products",

      variants:
        "/api/v1/menu/variants",

      modifierGroups:
        "/api/v1/menu/modifier-groups",

      ingredients:
        "/api/v1/menu/ingredients",

      allergens:
        "/api/v1/menu/allergens",
    },
  });
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/v1/menu/categories",
  categoryRoutes
);

app.use(
  "/api/v1/menu/products",
  productRoutes
);

app.use(
  "/api/v1/menu/variants",
  variantRoutes
);

app.use(
  "/api/v1/menu/modifier-groups",
  modifierGroupRoutes
);

app.use(
  "/api/v1/menu/ingredients",
  ingredientRoutes
);

app.use(
  "/api/v1/menu/allergens",
  allergenRoutes
);

app.use(
  "/api/v1/menu/customer/catalog",
  customerCatalogRoutes
);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message:
      "Route not found",
    path: req.originalUrl,
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  (error, req, res, next) => {
    console.error(
      "[Menu Service Error]",
      error
    );

    res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Internal server error",
    });
  }
);

/*
|--------------------------------------------------------------------------
| Start Service
|--------------------------------------------------------------------------
*/

async function start() {
  try {
    console.log(
      "[Menu Service] Starting..."
    );

    /*
     * MongoDB
     */
    await connectDb();

    console.log(
      "[Menu Service] MongoDB connected"
    );

    /*
     * PostgreSQL
     */
    await pool.query("SELECT 1");

    console.log(
      "[Menu Service] PostgreSQL connected"
    );

    /*
     * Redis
     */
    await connectRedis();

    console.log(
      "[Menu Service] Redis connected"
    );

    /*
     * HTTP Server
     */
    app.listen(
      PORT,
      () => {
        console.log(
          `[Menu Service] Running on port ${PORT}`
        );

        console.log(
          `[Menu Service] API: http://localhost:${PORT}`
        );

        console.log(
          `[Menu Service] Swagger: http://localhost:${PORT}/api-docs`
        );
      }
    );
  } catch (error) {
    console.error(
      "[Menu Service] Startup failed:",
      error
    );

    process.exit(1);
  }
}

start();

module.exports = app;
