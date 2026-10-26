import { afterEach, expect, it, vi } from 'vitest';
import type { ProfileInput } from '@/types/profile';
import { validateAvatarFile, validateProfileInput } from './profileValidation';

afterEach(() => vi.useRealTimers());

const input = (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
  dateOfBirth: '',
  phone: '',
  secondaryEmail: '',
  avatarFile: null,
  removeAvatar: false,
  ...overrides,
});

const ACCOUNT = 'an@truong.edu.vn';

it('allows today but rejects tomorrow as a birth date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 10, 0, 0));
  expect(
    validateProfileInput(input({ dateOfBirth: '2026-06-15' }), ACCOUNT),
  ).toEqual({});
  expect(
    validateProfileInput(input({ dateOfBirth: '2026-06-16' }), ACCOUNT),
  ).toHaveProperty('dateOfBirth');
});

it('accepts phones with spaces or dots and rejects other shapes', () => {
  for (const phone of ['', '0912345678', '0912 345 678', '0912.345.678'])
    expect(validateProfileInput(input({ phone }), ACCOUNT)).toEqual({});
  for (const phone of ['912345678', '09123456789', '84912345678', '09a2345678'])
    expect(validateProfileInput(input({ phone }), ACCOUNT)).toHaveProperty(
      'phone',
    );
});

it('rejects invalid secondary emails and the account email', () => {
  expect(
    validateProfileInput(input({ secondaryEmail: 'x@y.vn' }), ACCOUNT),
  ).toEqual({});
  expect(
    validateProfileInput(input({ secondaryEmail: 'sai' }), ACCOUNT),
  ).toHaveProperty('secondaryEmail');
  expect(
    validateProfileInput(
      input({ secondaryEmail: 'AN@truong.edu.vn' }),
      ACCOUNT,
    ),
  ).toHaveProperty('secondaryEmail');
});

it('limits avatar type and size', () => {
  const f = (type: string, size: number) => {
    const file = new File(['x'], 'a', { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };
  expect(validateAvatarFile(f('image/webp', 2 * 1024 * 1024))).toBeNull();
  expect(validateAvatarFile(f('image/gif', 10))).toMatch(/JPG, PNG hoặc WebP/);
  expect(validateAvatarFile(f('image/png', 2 * 1024 * 1024 + 1))).toBe(
    'Ảnh tối đa 2 MB.',
  );
});
