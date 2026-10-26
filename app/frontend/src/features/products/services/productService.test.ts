import { afterEach, expect, it, vi } from 'vitest';
import { productService } from './productService';

afterEach(() => vi.unstubAllGlobals());

it('loads products through the Next.js API proxy', async () => {
  const product = {
    id: '1',
    name: 'Keyboard',
    description: '',
    price: 100,
    stock: 2,
    isActive: true,
    createdAt: '',
  };
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [product] }),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(productService.getAll()).resolves.toEqual([product]);
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/products',
    expect.objectContaining({ cache: 'no-store' }),
  );
});

it('surfaces API validation errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, message: 'Validation failed' }),
    }),
  );

  await expect(
    productService.create({ name: '', description: '', price: -1, stock: 0 }),
  ).rejects.toThrow('Validation failed');
});

it('reports an unavailable backend when the proxy returns a non-JSON error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }),
  );

  await expect(productService.getAll()).rejects.toThrow(
    'Backend unavailable (HTTP 502)',
  );
});
