/**
 * useProductsStore — Zustand store لإدارة منتجات مكان محدد.
 */

import { create } from 'zustand';
import { productService, Product, CreateProductForm } from '../services/productService';

interface ProductsState {
  products: Product[];
  loading: boolean;
  error: string | null;
  currentPlaceId: string | null;

  loadByPlace: (placeId: string) => Promise<void>;
  createProduct: (placeId: string, form: CreateProductForm) => Promise<Product>;
  updateProduct: (placeId: string, productId: string, updates: Partial<CreateProductForm>) => Promise<Product>;
  deleteProduct: (placeId: string, productId: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  loading: false,
  error: null,
  currentPlaceId: null,

  loadByPlace: async (placeId) => {
    set({ loading: true, error: null, currentPlaceId: placeId });
    try {
      const products = await productService.getByPlaceId(placeId);
      set({ products, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'فشل تحميل المنتجات' });
    }
  },

  createProduct: async (placeId, form) => {
    const product = await productService.create(placeId, form);
    set({ products: [...get().products, product] });
    return product;
  },

  updateProduct: async (placeId, productId, updates) => {
    const updated = await productService.update(placeId, productId, updates);
    set({
      products: get().products.map((p) => (p.id === productId ? updated : p)),
    });
    return updated;
  },

  deleteProduct: async (placeId, productId) => {
    await productService.delete(placeId, productId);
    set({ products: get().products.filter((p) => p.id !== productId) });
  },

  reset: () => set({ products: [], loading: false, error: null, currentPlaceId: null }),

  clearError: () => set({ error: null }),
}));
