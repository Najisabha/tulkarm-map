/**
 * productService — خدمة منتجات الأماكن (stores).
 */

import { api } from '../api/client';

export interface Product {
  id: string;
  placeId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stock: number;
  isAvailable: boolean;
  sortOrder: number;
  mainCategory: string | null;
  subCategory: string | null;
  companyName: string | null;
}

export interface CreateProductForm {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  stock?: number;
  mainCategory?: string | null;
  subCategory?: string | null;
  companyName?: string | null;
}

function mapProduct(raw: any, placeId: string): Product {
  return {
    id: raw.id,
    placeId: raw.place_id ?? placeId,
    name: raw.name,
    description: raw.description ?? null,
    price: parseFloat(raw.price ?? 0),
    imageUrl: raw.image_url ?? null,
    stock: raw.stock ?? -1,
    isAvailable: raw.is_available ?? true,
    sortOrder: raw.sort_order ?? 0,
    mainCategory: raw.main_category ?? null,
    subCategory: raw.sub_category ?? null,
    companyName: raw.company_name ?? null,
  };
}

export const productService = {
  /** جلب منتجات مكان */
  async getByPlaceId(placeId: string): Promise<Product[]> {
    const res = await api.getStoreProducts(placeId);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((p: any) => mapProduct(p, placeId));
  },

  /** إضافة منتج */
  async create(placeId: string, form: CreateProductForm): Promise<Product> {
    const res = await api.addStoreProduct(placeId, {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      price: form.price,
      image_url: form.imageUrl || undefined,
      stock: form.stock ?? -1,
      main_category: form.mainCategory ?? null,
      sub_category: form.subCategory ?? null,
      company_name: form.companyName ?? null,
    });
    return mapProduct(res.data, placeId);
  },

  /** تحديث منتج */
  async update(placeId: string, productId: string, updates: Partial<CreateProductForm>): Promise<Product> {
    const res = await api.updateStoreProduct(placeId, productId, {
      name: updates.name?.trim(),
      description: updates.description?.trim(),
      price: updates.price,
      image_url: updates.imageUrl,
      stock: updates.stock,
      main_category: updates.mainCategory,
      sub_category: updates.subCategory,
      company_name: updates.companyName,
    });
    return mapProduct(res.data, placeId);
  },

  /** حذف منتج */
  async delete(placeId: string, productId: string): Promise<void> {
    await api.deleteStoreProduct(placeId, productId);
  },
};
