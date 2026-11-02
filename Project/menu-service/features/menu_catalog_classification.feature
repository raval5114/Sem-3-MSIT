Feature: Menu catalog food profile and safe filtering
  The end-to-end workflow is:
  Create Category -> Create Ingredients -> Create Recipe -> Create Menu Item
  -> Build Food Graph -> Query Food Profile -> Apply Dietary/Allergen Filter.

  This feature describes a mock-backed contract test. Category, ingredient, and
  product steps call the real service functions and Mongoose schemas. Recipe,
  graph, profile, and filter steps use in-memory implementations because those
  production modules are not implemented yet.

  Background:
    Given an isolated in-memory restaurant catalog

  Scenario: Run the complete workflow and return a safe matching menu item
    When I create the menu category
    And I create the ingredients for paneer pizza and peanut noodles
    And I create recipes for both menu items
    And I create both menu items in the category
    And I build the food graph from the recipes and ingredient allergen data
    And I query the paneer pizza food profile
    Then its profile includes its ingredients, vegetarian tag, and milk allergen
    When I filter the menu for vegetarian items excluding peanuts
    Then paneer pizza is included
    And peanut noodles are excluded
    And the eligible paneer pizza result is classified as True Positive
    And the excluded peanut noodles result is classified as True Negative

  Scenario: Detect a false negative in the dietary/allergen filter
    Given an item is valid for the requested dietary/allergen constraints
    When the filter omits that item
    Then the checklist classifies the result as False Negative

  Scenario: Detect a false positive in the dietary/allergen filter
    Given an item violates an excluded allergen constraint
    When the filter returns that item
    Then the checklist classifies the result as False Positive
