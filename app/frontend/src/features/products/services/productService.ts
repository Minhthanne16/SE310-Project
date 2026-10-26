import { apiRequest } from '@/api/request';
import type {
  Product,
  CreateProductDto,
  UpdateProductDto,
} from '@/features/products/types';

export const productService = {
  async getAll(): Promise<Product[]> {
    return apiRequest<Product[]>('/products');
  },

  async getById(id: string): Promise<Product> {
    return apiRequest<Product>(`/products/${id}`);
  },

  async create(data: CreateProductDto): Promise<Product> {
    return apiRequest<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateProductDto): Promise<Product> {
    return apiRequest<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<boolean> {
    return apiRequest<boolean>(`/products/${id}`, { method: 'DELETE' });
  },
};
