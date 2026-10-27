# DineFlow — Menu Service Implementation & Food Knowledge Graph

## 1. Overview

The Menu Service is the foundation for DineFlow's menu-related functionality.

It should not be treated as a simple CRUD service. It must provide reliable menu data that can later support:

- Dynamic/adaptive menus
- Food knowledge graph queries
- Dietary and allergen-aware filtering
- Personalized dining experiences
- Restaurant rules
- Availability-aware menu views
- Future AI restaurant-agent features

### Technology

- Runtime: Node.js
- Framework: Express.js
- Primary Database: MongoDB
- Cache: Redis
- Architecture: Modular microservice
- Future integration: Event-driven communication with other DineFlow services

---

## 2. Core Design Principle

The Menu Service should maintain three logical layers:

```text
                    ┌─────────────────────┐
                    │     Master Menu     │
                    │ Categories          │
                    │ Food Items          │
                    │ Variants            │
                    │ Modifiers           │
                    │ Ingredients         │
                    │ Recipes             │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Food Knowledge      │
                    │ Graph               │
                    │ Ingredients         │
                    │ Allergens           │
                    │ Dietary Tags        │
                    │ Recipes             │
                    │ Relationships       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Adaptive Menu       │
                    │ Availability        │
                    │ Restaurant Rules    │
                    │ Customer Context    │
                    │ Graph Constraints   │
                    │ Ranking             │
                    └─────────────────────┘
```

The Master Menu remains the source of truth.

The Food Knowledge Graph enriches the master menu with semantic relationships.

The Adaptive Menu creates a contextual view of the master menu and must not permanently modify the master menu for an individual customer.

---

## 3. Recommended Project Structure

```text
menu-service/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── env.js
│   ├── modules/
│   │   ├── category/
│   │   ├── menu-item/
│   │   ├── variant/
│   │   ├── modifier/
│   │   ├── ingredient/
│   │   ├── allergen/
│   │   ├── dietary/
│   │   ├── recipe/
│   │   ├── knowledge-graph/
│   │   └── adaptive-menu/
│   ├── events/
│   │   ├── eventBus.js
│   │   └── menuEvents.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── utils/
│   ├── app.js
│   └── server.js
├── tests/
├── Dockerfile
├── package.json
├── .env
└── README.md
```

---

## 4. Phase 1 — Menu Foundation

### 4.1 Category

A category organizes food items.

```json
{
  "restaurantId": "restaurant_001",
  "name": "Pizzas",
  "description": "Freshly prepared pizzas",
  "displayPriority": 1,
  "isActive": true
}
```

Suggested APIs:

```text
POST   /api/v1/menu/categories
GET    /api/v1/menu/categories
GET    /api/v1/menu/categories/:id
PUT    /api/v1/menu/categories/:id
DELETE /api/v1/menu/categories/:id
```

---

## 5. Phase 2 — Product / Menu Item

The menu item is the main product entity.

### Suggested Model

```json
{
  "_id": "food_001",
  "restaurantId": "restaurant_001",
  "categoryId": "category_pizza",
  "name": "Paneer Pizza",
  "description": "Pizza topped with paneer and mozzarella",
  "basePrice": 299,
  "isAvailable": true,
  "status": "ACTIVE",
  "dietaryTags": ["VEGETARIAN"],
  "spiceLevel": 2,
  "imageUrl": "/images/paneer-pizza.jpg",
  "preparationTimeMinutes": 20,
  "variants": [],
  "modifierGroups": [],
  "ingredients": [],
  "recipeId": "recipe_paneer_pizza_v1",
  "displayPriority": 1,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Product APIs

```text
POST   /api/v1/menu/items
GET    /api/v1/menu/items
GET    /api/v1/menu/items/:id
PUT    /api/v1/menu/items/:id
DELETE /api/v1/menu/items/:id
PATCH  /api/v1/menu/items/:id/availability
PATCH  /api/v1/menu/items/:id/status
```

---

## 6. Product Creation Workflow

```text
Create Product
      │
      ▼
Validate Category
      │
      ▼
Validate Variants
      │
      ▼
Validate Modifiers
      │
      ▼
Validate Ingredients
      │
      ▼
Create / Update Recipe
      │
      ▼
Update Food Knowledge Graph
      │
      ▼
Publish MenuUpdated Event
      │
      ▼
Invalidate Redis Cache
```

---

## 7. Variants

Variants represent different versions of the same food item.

Example:

```json
{
  "name": "Size",
  "options": [
    { "name": "Small", "priceAdjustment": 0 },
    { "name": "Medium", "priceAdjustment": 80 },
    { "name": "Large", "priceAdjustment": 150 }
  ]
}
```

Example:

```text
Paneer Pizza
├── Small   → ₹299
├── Medium  → ₹379
└── Large   → ₹449
```

---

## 8. Modifier Groups

Modifiers represent optional or configurable additions.

Example:

```text
Crust
├── Thin Crust
├── Cheese Burst
└── Classic

Extra Toppings
├── Extra Cheese
├── Jalapeno
├── Olives
└── Paneer
```

A modifier group should support:

```text
minimumSelection
maximumSelection
required
options
priceAdjustment
```

Example:

```json
{
  "name": "Extra Toppings",
  "required": false,
  "minSelection": 0,
  "maxSelection": 3,
  "options": [
    { "name": "Extra Cheese", "priceAdjustment": 50 },
    { "name": "Paneer", "priceAdjustment": 70 }
  ]
}
```

---

## 9. Phase 3 — Ingredients

Ingredients become the foundation of the Food Knowledge Graph.

Example:

```json
{
  "_id": "ingredient_paneer",
  "name": "Paneer",
  "category": "DAIRY",
  "isActive": true
}
```

Possible ingredients:

```text
Paneer
Mozzarella
Pizza Base
Tomato
Onion
Capsicum
Peanut
Milk
Butter
Spice Mix
```

Ingredient definitions should be reused rather than duplicated unnecessarily.

---

## 10. Phase 4 — Recipes

A recipe defines the ingredients used by a food item.

Recipe should be a first-class entity.

```json
{
  "_id": "recipe_paneer_pizza_v1",
  "foodItemId": "food_001",
  "version": 1,
  "ingredients": [
    {
      "ingredientId": "ingredient_paneer",
      "quantity": 100,
      "unit": "GRAM"
    },
    {
      "ingredientId": "ingredient_mozzarella",
      "quantity": 80,
      "unit": "GRAM"
    },
    {
      "ingredientId": "ingredient_pizza_base",
      "quantity": 1,
      "unit": "UNIT"
    }
  ],
  "status": "ACTIVE"
}
```

Recipe versions should be preserved when ingredient composition changes.

---

## 11. Food Knowledge Graph

### Goal

The Food Knowledge Graph provides semantic relationships between food items, recipes, ingredients, allergens and dietary information.

The initial implementation should remain logical and can be represented using MongoDB collections/documents.

A dedicated graph database such as Neo4j should only be introduced if the graph/query workload later requires it.

---

## 12. Graph Entities

Initial node types:

```text
FoodItem
Ingredient
Allergen
DietaryTag
Recipe
```

---

## 13. Graph Relationships

```text
FoodItem
   │
   ├── HAS_RECIPE ─────────► Recipe
   ├── HAS_DIET ───────────► DietaryTag
   └── BELONGS_TO ─────────► Category

Recipe
   │
   └── CONTAINS ───────────► Ingredient

Ingredient
   │
   ├── CONTAINS ───────────► Ingredient
   └── TRIGGERS ───────────► Allergen
```

---

## 14. Example Food Graph

For Paneer Pizza:

```text
Paneer Pizza
     │
     │ HAS_RECIPE
     ▼
Paneer Pizza Recipe
     │
     ├── CONTAINS ──► Paneer
     │                   │
     │                   └── CONTAINS ──► Milk
     │
     ├── CONTAINS ──► Mozzarella
     │                   │
     │                   └── CONTAINS ──► Milk
     │
     └── CONTAINS ──► Pizza Base
```

This allows the system to derive:

```text
Paneer Pizza
    ↓
Paneer
    ↓
Milk
    ↓
Dairy
```

---

## 15. Allergen Safety Model

The graph should distinguish between different levels of allergen knowledge.

Supported relationship states:

```text
CONTAINS
MAY_CONTAIN
UNKNOWN
```

Example:

```text
Ingredient → Peanut
Relationship: CONTAINS
```

or:

```text
Food Item → Peanut
Relationship: MAY_CONTAIN
```

The system must not claim an item is allergen-free unless the available information verifies that conclusion.

---

## 16. Knowledge Graph APIs

Initial APIs:

```text
GET /api/v1/menu/items/:id/food-profile
GET /api/v1/menu/items/:id/allergens
GET /api/v1/menu/items/:id/ingredients
GET /api/v1/menu/items/:id/dietary
```

Filtering examples:

```text
GET /api/v1/menu/search?excludeAllergen=PEANUT
GET /api/v1/menu/search?diet=VEGETARIAN
GET /api/v1/menu/search?diet=VEGAN
```

---

## 17. Food Profile

A food profile can combine graph information into one response.

```json
{
  "foodItemId": "food_001",
  "name": "Paneer Pizza",
  "dietaryTags": ["VEGETARIAN"],
  "ingredients": [
    "Paneer",
    "Mozzarella",
    "Pizza Base"
  ],
  "allergens": [
    {
      "name": "Dairy",
      "status": "CONTAINS"
    }
  ],
  "derivedRelationships": [
    {
      "from": "Paneer",
      "relation": "CONTAINS",
      "to": "Milk"
    },
    {
      "from": "Mozzarella",
      "relation": "CONTAINS",
      "to": "Milk"
    }
  ]
}
```

---

## 18. Phase 5 — Dynamic / Adaptive Menu

The Dynamic Menu creates a contextual menu view rather than modifying the master menu.

```text
Master Menu
     │
     ▼
Availability Filter
     │
     ▼
Restaurant Rules
     │
     ▼
Customer Context
     │
     ▼
Food Knowledge Graph
     │
     ▼
Ranking
     │
     ▼
Adaptive Menu
```

Potential inputs:

- Item availability
- Restaurant rules
- Time/day
- Customer dietary preferences
- Customer allergen exclusions
- Customer preferences
- Previous interactions
- Ingredient relationships
- Restaurant inventory
- Menu configuration

---

## 19. Restaurant Rules

Restaurant-specific behavior should use structured rules instead of frontend hardcoded logic.

Examples:

```text
Lunch menu active from 12:00 to 15:00
Breakfast items unavailable after 11:00
Certain products unavailable when inventory is low
Certain categories visible only during specific hours
```

Example:

```json
{
  "type": "TIME_WINDOW",
  "target": "category_breakfast",
  "start": "07:00",
  "end": "11:00",
  "enabled": true
}
```

---

## 20. Customer Context

Customer context may eventually contain:

```text
Dietary preference
Allergen exclusions
Spice preference
Favorite categories
Previous orders
Recently viewed items
Cart
Wishlist
```

The adaptive menu should use this context to determine what should be shown or prioritized.

---

## 21. Event-Driven Design

Important domain events:

```text
MenuUpdated
InventoryChanged
ItemSoldOut
ItemAvailable
IngredientChanged
RestaurantRuleChanged
CustomerPreferenceChanged
```

Example:

```text
Admin updates Paneer Pizza
        │
        ▼
MongoDB updated
        │
        ├──────────────► Food Graph updated
        ├──────────────► Redis invalidated
        └──────────────► MenuUpdated event
```

Other services can consume these events without tightly coupling themselves to the Menu Service.

---

## 22. Redis Caching

Redis should be introduced after the core data model and behavior are correct.

Suggested keys:

```text
menu:{restaurantId}:categories
menu:{restaurantId}:item:{itemId}
menu:{restaurantId}:published
menu:{restaurantId}:adaptive:{contextHash}
```

Cache update flow:

```text
Update MongoDB
      │
      ▼
Update Knowledge Graph
      │
      ▼
Delete affected Redis keys
      │
      ▼
Publish MenuUpdated
```

Cache correctness is more important than premature caching.

---

## 23. Suggested Implementation Order

### Sprint 1 — Service Foundation

- Express application
- Environment configuration
- MongoDB connection
- Redis connection
- Error handling
- Request validation
- Logging
- Docker configuration
- Health endpoint

```text
GET /health
```

### Sprint 2 — Categories

- Category model
- Repository
- Service
- Controller
- Routes
- Validation
- Tests

### Sprint 3 — Menu Items

- Menu item model
- CRUD
- Availability
- Status
- Category relationship
- Basic validation

### Sprint 4 — Variants & Modifiers

- Variants
- Modifier groups
- Modifier options
- Selection constraints
- Price adjustments

### Sprint 5 — Ingredients & Recipes

- Ingredient model
- Ingredient CRUD
- Recipe model
- Recipe versions
- Food item → recipe relationship

### Sprint 6 — Food Knowledge Graph

- Graph node representation
- Graph relationships
- Food profile generation
- Ingredient traversal
- Allergen traversal
- Dietary relationships

### Sprint 7 — Graph Query APIs

Implement:

```text
food-profile
ingredients
allergens
dietary filtering
allergen exclusion
```

### Sprint 8 — Adaptive Menu

Implement:

```text
Availability
+
Restaurant Rules
+
Customer Context
+
Food Graph
+
Ranking
```

### Sprint 9 — Redis

Implement:

- Menu caching
- Food profile caching
- Adaptive menu caching
- Cache invalidation
- Cache-aside pattern

### Sprint 10 — Events & Integration

Implement:

- Domain events
- Event publisher
- Event consumers where required
- Integration with inventory/order/customer services

---

## 24. Testing Strategy

### Unit Tests

Test:

```text
CategoryService
MenuItemService
RecipeService
KnowledgeGraphService
AdaptiveMenuService
```

Examples:

```text
Should reject invalid category
Should reject invalid price
Should reject unavailable category
Should create menu item
Should update recipe
Should derive allergen relationship
Should filter excluded allergens
```

### Integration Tests

Test:

```text
API → Service → Repository → MongoDB
```

and:

```text
Menu Update → Graph Update → Redis Invalidation → Event
```

### End-to-End Test

```text
Create Category
    ↓
Create Ingredients
    ↓
Create Recipe
    ↓
Create Menu Item
    ↓
Build Food Graph
    ↓
Query Food Profile
    ↓
Apply Dietary/Allergen Filter
    ↓
Return Adaptive Menu
```

---

## 25. First MVP

Do not implement the entire adaptive/AI system immediately.

The first MVP should be:

```text
Category CRUD
       +
Menu Item CRUD
       +
Variants
       +
Modifiers
       +
Ingredients
       +
Recipes
       +
Food Knowledge Graph
       +
Basic Graph Queries
```

Then add:

```text
Adaptive Menu
       ↓
Redis
       ↓
Events
       ↓
Advanced Personalization
```

---

## 26. First Demo Target

### Admin Side

1. Create `Pizzas` category.
2. Create ingredients:
   - Paneer
   - Mozzarella
   - Milk
   - Pizza Base
   - Spice Mix
3. Create Paneer Pizza.
4. Add variants.
5. Add extra-topping modifiers.
6. Create the recipe.
7. Generate/update the food graph.

### Customer Side

Request:

```text
GET /api/v1/menu/items/food_001/food-profile
```

The response should expose:

```text
Food Item
Ingredients
Dietary Tags
Allergens
Ingredient Relationships
Recipe information
```

Then test:

```text
GET /api/v1/menu/search?excludeAllergen=PEANUT
```

and dietary filtering.

---

## 27. Architecture Rule

Keep these concepts separate:

```text
MASTER MENU
    ↓
FOOD KNOWLEDGE
    ↓
ADAPTIVE MENU
```

### Master Menu

What the restaurant actually sells.

### Food Knowledge

What the system knows about the food.

### Adaptive Menu

What should be shown to a particular customer/context.

This separation supports the longer roadmap:

```text
Dynamic Menu
      ↓
Food Knowledge Graph
      ↓
Personal Dining Agent
      ↓
AI Restaurant Agent
      ↓
Kitchen Intelligence
      ↓
Simulation
```

---

## 28. Immediate Next Task

Start implementation in this order:

```text
1. Initialize Node.js + Express project
2. Configure MongoDB
3. Configure Redis
4. Create Category module
5. Create Menu Item module
6. Add variants and modifiers
7. Create Ingredient module
8. Create Recipe module
9. Implement Food Knowledge Graph
10. Implement graph query APIs
11. Add Adaptive Menu
12. Add Redis caching
13. Add domain events
14. Add integration tests
```

The priority is **correct domain modeling first, graph capabilities second, adaptive behavior third, and optimization/event infrastructure after correctness is established.**
