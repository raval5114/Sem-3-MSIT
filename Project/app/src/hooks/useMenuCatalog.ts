import { useCallback, useEffect, useState } from 'react';
import { menuService, type Category, type Product } from '../services/menuService';

export function useMenuCatalog(restaurantId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!restaurantId) {
      setCategories([]);
      setProducts([]);
      setError('This account has no restaurant scope in its session.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [nextCategories, nextProducts] = await Promise.all([
        menuService.categories.list(restaurantId),
        menuService.products.list({ restaurantId }),
      ]);
      // Keep the dashboard's render state valid even if a service adapter is
      // changed later or returns an unexpected value at runtime.
      if (!Array.isArray(nextCategories) || !Array.isArray(nextProducts)) {
        throw new Error('The menu service returned invalid catalog data. Please retry.');
      }
      setCategories(nextCategories);
      setProducts(nextProducts);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load menu data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createCategory = useCallback(async (payload: Partial<Category>) => {
    await menuService.categories.create({ ...payload, restaurantId });
    await refresh();
  }, [refresh, restaurantId]);

  const createProduct = useCallback(async (payload: Partial<Product>) => {
    await menuService.products.create({ ...payload, restaurantId });
    await refresh();
  }, [refresh, restaurantId]);

  const setAvailability = useCallback(async (product: Product, isAvailable: boolean) => {
    await menuService.products.setAvailability(product._id, isAvailable);
    await refresh();
  }, [refresh]);

  const setStatus = useCallback(async (product: Product, status: Product['status']) => {
    await menuService.products.setStatus(product._id, status);
    await refresh();
  }, [refresh]);

  const deleteProduct = useCallback(async (product: Product) => {
    await menuService.products.delete(product._id);
    await refresh();
  }, [refresh]);

  const deleteCategory = useCallback(async (category: Category) => {
    await menuService.categories.delete(category._id);
    await refresh();
  }, [refresh]);

  return {
    categories,
    products,
    loading,
    error,
    refresh,
    createCategory,
    createProduct,
    setAvailability,
    setStatus,
    deleteProduct,
    deleteCategory,
  };
}
