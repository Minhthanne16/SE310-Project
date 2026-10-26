'use client';

import React, { useState, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ProductsHeader } from './ProductsHeader';
import { ProductCard } from '@/features/products/components/ProductCard';
import { ProductFormModal } from '@/features/products/components/ProductFormModal';
import { productService } from '@/features/products/services/productService';
import type {
  Product,
  CreateProductDto,
  UpdateProductDto,
} from '@/features/products/types';
import {
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await productService.getAll();
      setProducts(data);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Lỗi kết nối Backend',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term),
    );
  }, [products, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    try {
      setActionLoading(true);
      await productService.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFormSubmit = async (
    data: CreateProductDto | UpdateProductDto,
  ) => {
    try {
      setActionLoading(true);
      if (editingProduct) {
        const res = await productService.update(
          editingProduct.id,
          data as UpdateProductDto,
        );
        setProducts((prev) => prev.map((p) => (p.id === res.id ? res : p)));
      } else {
        const res = await productService.create(data as CreateProductDto);
        setProducts((prev) => [res, ...prev]);
      }
      toast.success('Đã lưu sản phẩm');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <ProductsHeader />
      <main className="container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              Danh Sách Sản Phẩm
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              REST API từ ASP.NET Core 10
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={fetchProducts}
              className="btn btn-outline"
              disabled={loading}
            >
              <RefreshCw size={15} /> Tải lại
            </button>
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
            >
              <Plus size={16} /> Thêm sản phẩm
            </button>
          </div>
        </div>

        <div className="search-box">
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {errorMessage && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <div>
              <strong>Lỗi kết nối:</strong> {errorMessage}
              <div style={{ fontSize: '0.8rem' }}>
                Backend cần chạy ở http://localhost:5290
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p
            style={{
              textAlign: 'center',
              padding: '40px 0',
              color: 'var(--text-secondary)',
            }}
          >
            Đang nạp dữ liệu...
          </p>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag
              size={36}
              color="var(--text-muted)"
              style={{ margin: '0 auto 12px' }}
            />
            <p>Không tìm thấy sản phẩm nào.</p>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={(item) => {
                  setEditingProduct(item);
                  setIsModalOpen(true);
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <footer
        style={{
          textAlign: 'center',
          padding: 20,
          borderTop: '1px solid var(--border)',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        SE310 Project - Clean Architecture (.NET 10) + Next.js 16
      </footer>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingProduct}
        loading={actionLoading}
      />
      <Toaster position="top-right" />
    </div>
  );
};

export default ProductsPage;
