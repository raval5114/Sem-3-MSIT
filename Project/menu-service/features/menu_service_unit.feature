Feature: Menu service unit behavior
  CategoryService and MenuItemService are backed by the current service code.
  RecipeService, KnowledgeGraphService, and AdaptiveMenuService are specified
  here for coverage, but their production modules are not implemented yet.

  Scenario: Reject an invalid category
    When I create a category without its required name
    Then CategoryService rejects the category

  Scenario: Reject an invalid menu-item price
    Given a category exists for the restaurant
    When I create a menu item with a negative price
    Then MenuItemService rejects the menu item

  Scenario: Reject an unavailable category
    Given a category exists but is inactive
    When I create a menu item in that category
    Then MenuItemService rejects the menu item

  Scenario: Create a menu item
    Given an active category exists for the restaurant
    When I create a menu item with a non-negative price
    Then MenuItemService creates the menu item

  Scenario: Update a recipe
    Given a menu item has an existing recipe
    When I update the recipe ingredients
    Then RecipeService saves the updated recipe

  Scenario: Derive an allergen relationship
    Given a recipe contains an ingredient linked to an allergen
    When KnowledgeGraphService builds the food graph
    Then the food profile reports the derived allergen relationship

  Scenario: Filter excluded allergens
    Given a menu item contains an excluded allergen
    When AdaptiveMenuService filters the menu
    Then the item is absent from the adaptive menu
