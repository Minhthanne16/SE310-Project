import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import { profileService } from './profileService';

afterEach(() => vi.unstubAllGlobals());

const dto = {
  id: '1',
  userCode: 'U1',
  fullName: 'Lê Thị Bình',
  email: 'binh.lt@truong.edu.vn',
  role: 'Student',
  dateOfBirth: null,
  phone: null,
  secondaryEmail: null,
  avatarUrl: null,
  className: 'KTPM2022',
  department: null,
  academicTitle: null,
  lastLogins: ['2026-11-06T01:00:00.000Z'],
};

const stubFetch = (data: unknown = dto, ok = true, status = 200, extra = {}) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ success: ok, message: '', data, ...extra }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const input = {
  fullName: 'Lê Thị Bình',
  dateOfBirth: '',
  phone: '0901 234 567',
  secondaryEmail: 'Binh@Mail.com',
  avatarFile: null,
  removeAvatar: false,
};

it('reads the profile from the API and turns null contact fields into empty text', async () => {
  const fetchMock = stubFetch();
  await expect(profileService.getProfile()).resolves.toMatchObject({
    fullName: 'Lê Thị Bình',
    phone: '',
    secondaryEmail: '',
    className: 'KTPM2022',
  });
  expect(fetchMock.mock.calls[0][0]).toBe('/api/profile');
});

it('saves only the editable fields and sends an empty birth date as null', async () => {
  const fetchMock = stubFetch({ ...dto, phone: '0901234567' });
  const saved = await profileService.updateProfile(input);
  expect(saved.phone).toBe('0901234567');
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/profile');
  expect(init.method).toBe('PUT');
  expect(JSON.parse(init.body)).toEqual({
    fullName: 'Lê Thị Bình',
    dateOfBirth: null,
    phone: '0901 234 567',
    secondaryEmail: 'Binh@Mail.com',
  });
});

it('uploads the avatar as multipart without a JSON content type', async () => {
  const fetchMock = stubFetch({ ...dto, avatarUrl: '/api/profile/avatar?v=a' });
  const file = new File(['x'], 'a.png', { type: 'image/png' });
  const saved = await profileService.uploadAvatar(file);
  expect(saved.avatarUrl).toBe('/api/profile/avatar?v=a');
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/profile/avatar');
  expect(init.method).toBe('PUT');
  expect((init.body as FormData).get('file')).toBe(file);
  expect(init.headers).not.toHaveProperty('Content-Type');
});

it('removes the avatar through DELETE', async () => {
  const fetchMock = stubFetch();
  await expect(profileService.removeAvatar()).resolves.toMatchObject({
    avatarUrl: null,
  });
  expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
});

it('surfaces server validation errors', async () => {
  stubFetch(null, false, 400, {
    message: 'Validation failed',
    errors: ['Nhập họ tên.'],
  });
  const error = await profileService.updateProfile(input).catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(400);
  expect(error.message).toBe('Nhập họ tên.');
});
