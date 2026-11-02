# DineFlow Menu Service Test Checklist

Paired with [`menu_catalog_classification.feature`](../features/menu_catalog_classification.feature), [`menu_service_unit.feature`](../features/menu_service_unit.feature), and the offline runners [`menu-service.mock.test.js`](../test/menu-service.mock.test.js) and [`menu-service.services.test.js`](../test/menu-service.services.test.js).

## Service coverage

| Service in the plan | Current implementation | Automated coverage |
|---|---|---|
| `CategoryService` | Implemented as `categories.service.js` | Missing required category name is rejected using the real schema. |
| `MenuItemService` | Implemented as `product.service.js` | Negative price is rejected; valid product is created; inactive-category assignment is rejected. |
| `RecipeService` | `recipe.service.js` is empty | Update-recipe case is marked TODO. |
| `KnowledgeGraphService` | `knowledge_graph.service.js` is empty | Allergen derivation is covered only by the mock E2E contract; production-service case is TODO. |
| `AdaptiveMenuService` | `menu.service.js` is empty | Allergen filtering is covered only by the mock E2E contract; production-service case is TODO. |

## Workflow checklist

Run `npm test` from `Project/menu-service`. The E2E mock uses the actual category, ingredient, and product services and Mongoose schemas with in-memory persistence. Recipe, food-graph, profile, and filter stages are in-memory contract implementations because their production service modules are currently empty. The service-level tests also exercise category and product validation with in-memory model persistence.

| # | Workflow stage | Expected check | Result |
|---|---|---|---|
| 1 | Create Category | Category is validated and stored for the mock restaurant | ☐ |
| 2 | Create Ingredients | Milk, paneer, peanut, and noodles pass the ingredient schema and are stored | ☐ |
| 3 | Create Recipe | Both recipes reference existing ingredients and target planned menu-item IDs | ☐ |
| 4 | Create Menu Item | Both products pass schema validation and reference the category and recipe | ☐ |
| 5 | Build Food Graph | Recipe ingredient relationships derive `MILK` and `PEANUT` allergens | ☐ |
| 6 | Query Food Profile | Paneer Pizza profile returns ingredients, `VEGETARIAN`, and milk `CONTAINS` | ☐ |
| 7 | Apply Dietary/Allergen Filter | Vegetarian items excluding peanuts include Paneer Pizza and exclude Peanut Noodles | ☐ |
| 8 | Allergen exclusion check | Excluding milk removes Paneer Pizza | ☐ |

## Service behavior checklist

| Service | Case | Expected result | Current test status |
|---|---|---|---|
| CategoryService | Reject category without required name | Validation rejection | Covered |
| MenuItemService | Reject negative price | Validation rejection | Covered |
| MenuItemService | Reject product under inactive category | Validation rejection | Covered and passing |
| MenuItemService | Create product in active category | Product created | Covered |
| RecipeService | Update recipe and preserve version history | Updated recipe | TODO: service is empty |
| KnowledgeGraphService | Derive allergen from recipe ingredient relationship | Allergen appears in food profile | Mock E2E only; service is empty |
| AdaptiveMenuService | Exclude item with requested allergen | Conflicting item omitted | Mock E2E only; service is empty |

## Four-outcome classification checklist

For the filter, **positive** means an item should be included under the requested diet/allergen constraints. **Negative** means it should be excluded. Compare that expected result (ground truth) with whether the filter returned the item.

| Type | Ground truth | Filter outcome | Workflow example / diagnostic |
|---|---|---|---|
| **True Positive (TP)** | Eligible item | Included | Paneer Pizza is vegetarian and has no peanut allergen; it remains when excluding peanuts. |
| **False Negative (FN)** | Eligible item | Excluded | Paneer Pizza is omitted from the vegetarian menu when only peanuts are excluded. |
| **True Negative (TN)** | Ineligible item | Excluded | Peanut Noodles are absent when peanuts are excluded. |
| **False Positive (FP)** | Ineligible item | Included | Peanut Noodles are returned even though peanuts are excluded. |

The automated suite asserts TP and TN for the seeded workflow and checks the TP/FN/TN/FP mapping table with synthetic outcome pairs. FN and FP are regression conditions: they should remain unobserved for the correct workflow.

## Scope note

The current menu service implements category, ingredient, and product CRUD. Recipe, knowledge-graph, food-profile, and dietary-filter modules/routes are empty, so those stages in `npm test` validate the specified workflow contract using mocks; they do **not** prove those production features are implemented. The existing HTTP integration checks are separate and require a running service and disposable database:

```bash
npm run test:integration
```
