import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ProductCard } from './ProductCard';

it('opens the selected product for editing', () => {
  const product = {
    id: 'abc',
    name: 'Keyboard',
    description: 'Mechanical keyboard',
    price: 100,
    stock: 2,
    isActive: true,
    createdAt: '',
  };
  const onEdit = vi.fn();

  render(<ProductCard product={product} onEdit={onEdit} onDelete={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /sửa/i }));

  expect(onEdit).toHaveBeenCalledWith(product);
});
