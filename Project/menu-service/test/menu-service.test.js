const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const { randomUUID } = require("node:crypto");

const BASE_URL = (
  process.env.MENU_SERVICE_URL || "http://localhost:3001"
).replace(/\/$/, "");
const API = `${BASE_URL}/api/v1/menu`;
const restaurantId = `test_restaurant_${randomUUID()}`;
const categoryName = `Automated Test Category ${randomUUID()}`;

let categoryId;
const temporaryCategoryIds = [];
const temporaryProductIds = [];

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { response, payload };
}

function classify(t, { scenario, validInput, response }) {
  const accepted = response.status >= 200 && response.status < 300;
  const observed = validInput
    ? (accepted ? "TP" : "FN")
    : (accepted ? "FP" : "TN");

  t.diagnostic(
    `${scenario}: ${observed} (HTTP ${response.status})`
  );
  return observed;
}

describe("menu catalog API classification", { concurrency: false }, () => {
  before(async () => {
    const { response, payload } = await request("/categories", {
      method: "POST",
      body: { restaurantId, name: categoryName },
    });

    if (response.ok && payload?.data?._id) {
      categoryId = payload.data._id;
      temporaryCategoryIds.push(categoryId);
    }
    assert.equal(
      response.status,
      201,
      `Test fixture category could not be created: HTTP ${response.status}`
    );
    assert.ok(categoryId, "Category response must include data._id");
  });

  after(async () => {
    for (const id of temporaryProductIds) {
      const { response } = await request(
        `/products/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      assert.equal(response.status, 200, "Temporary product cleanup failed");
    }

    for (const id of temporaryCategoryIds) {
      const { response } = await request(
        `/categories/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      assert.equal(response.status, 200, "Temporary category cleanup failed");
    }
  });

  it("accepts a valid category (TP; rejection would be FN)", async (t) => {
    const name = `Valid Category ${randomUUID()}`;
    const { response, payload } = await request("/categories", {
      method: "POST",
      body: { restaurantId, name },
    });
    if (response.ok && payload?.data?._id) {
      temporaryCategoryIds.push(payload.data._id);
    }

    assert.equal(
      classify(t, { scenario: "valid category create", validInput: true, response }),
      "TP"
    );
    assert.equal(response.status, 201);
    assert.equal(payload?.data?.name, name);

    assert.ok(payload?.data?._id, "Created category response must include data._id");
  });

  it("rejects a category missing its required name (TN; acceptance would be FP)", async (t) => {
    const { response, payload } = await request("/categories", {
      method: "POST",
      body: { restaurantId },
    });
    if (response.ok && payload?.data?._id) temporaryCategoryIds.push(payload.data._id);

    assert.equal(
      classify(t, { scenario: "category without name", validInput: false, response }),
      "TN"
    );
    assert.equal(response.status, 400);
  });

  it("accepts a valid product and returns its catalog details (TP; rejection would be FN)", async (t) => {
    const productId = `test_product_${randomUUID()}`;
    const name = `Automated Test Product ${randomUUID()}`;
    const { response, payload } = await request("/products", {
      method: "POST",
      body: {
        _id: productId,
        restaurantId,
        categoryId,
        name,
        basePrice: 100,
      },
    });
    if (response.ok) temporaryProductIds.push(productId);

    assert.equal(
      classify(t, { scenario: "valid product create", validInput: true, response }),
      "TP"
    );
    assert.equal(response.status, 201);
    assert.equal(payload?.data?._id, productId);
    const { response: detailsResponse, payload: detailsPayload } = await request(
      `/products/${encodeURIComponent(productId)}/details`
    );
    assert.equal(detailsResponse.status, 200);
    assert.equal(detailsPayload?.data?.category?._id, categoryId);
    assert.ok(Array.isArray(detailsPayload?.data?.variants));
    assert.ok(Array.isArray(detailsPayload?.data?.modifierGroups));
  });

  it("rejects a product referencing a missing category (TN; acceptance would be FP)", async (t) => {
    const invalidProductId = `test_product_${randomUUID()}`;
    const { response } = await request("/products", {
      method: "POST",
      body: {
        _id: invalidProductId,
        restaurantId,
        categoryId: "not-a-valid-category-id",
        name: `Invalid Category Product ${randomUUID()}`,
        basePrice: 100,
      },
    });
    if (response.ok) temporaryProductIds.push(invalidProductId);

    assert.equal(
      classify(t, { scenario: "product with missing category", validInput: false, response }),
      "TN"
    );
    assert.equal(response.status, 400);
  });
});
