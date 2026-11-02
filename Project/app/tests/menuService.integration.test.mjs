import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const baseUrl = process.env.MENU_SERVICE_BASE_URL || 'http://localhost:3001/api/v1/menu';
process.env.VITE_MENU_BASE_URL = baseUrl;

// menuService attaches an auth token from localStorage; the integration test
// calls public menu endpoints and does not need a browser or saved credentials.
globalThis.localStorage ??= { getItem: () => null };

const vite = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('..', import.meta.url)),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

const { menuService } = await vite.ssrLoadModule('/src/services/menuService.ts');

after(async () => {
  await vite.close();
});

const listRoutes = [
  ['categories', '/categories', () => menuService.categories.list()],
  ['products', '/products', () => menuService.products.list()],
  ['variants', '/variants', () => menuService.variants.list()],
  ['modifier groups', '/modifier-groups', () => menuService.modifierGroups.list()],
  ['ingredients', '/ingredients', () => menuService.ingredients.list()],
  ['allergens', '/allergens', () => menuService.allergens.list()],
];

test(`menuService list endpoints return arrays from ${baseUrl}`, async (t) => {
  for (const [name, path, load] of listRoutes) {
    await t.test(`GET ${path}`, async (subtest) => {
      let records;
      try {
        records = await load();
      } catch (error) {
        const detail = error?.response?.data
          ? ` Response: ${JSON.stringify(error.response.data)}`
          : '';
        assert.fail(`${name} request failed: ${error.message}.${detail}`);
      }

      assert.ok(Array.isArray(records), `${name} should resolve to an array`);
      subtest.diagnostic(`${records.length} record(s) returned`);
    });
  }
});
