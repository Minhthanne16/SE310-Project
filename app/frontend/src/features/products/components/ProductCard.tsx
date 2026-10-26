import React from 'react';
import type { Product } from '@/features/products/types';
import { Edit2, Trash2, Tag, Box, CheckCircle, XCircle } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onDelete,
}) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 16,
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {product.name}
          </h3>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: 12,
              backgroundColor: product.isActive ? '#dcfce7' : '#f1f5f9',
              color: product.isActive ? '#15803d' : '#64748b',
              fontWeight: 500,
            }}
          >
            {product.isActive ? (
              <CheckCircle size={12} />
            ) : (
              <XCircle size={12} />
            )}
            {product.isActive ? 'Đang bán' : 'Tạm dừng'}
          </span>
        </div>

        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginTop: 8,
            lineHeight: 1.5,
            minHeight: '2.6rem',
          }}
        >
          {product.description || 'Không có mô tả sản phẩm.'}
        </p>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            fontSize: '0.9rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#16a34a',
              fontWeight: 600,
              fontSize: '1.05rem',
            }}
          >
            <Tag size={16} />
            {formatPrice(product.price)}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            <Box size={16} />
            <span>
              Kho: <strong>{product.stock}</strong>
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 14,
          }}
        >
          <button
            onClick={() => onEdit(product)}
            className="btn btn-outline"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <Edit2 size={14} /> Sửa
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="btn btn-danger-ghost"
            title="Xóa sản phẩm"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
