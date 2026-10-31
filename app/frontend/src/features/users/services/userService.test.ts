import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import type { ManagedUser, UserImportReport, UserInput } from '@/types/user';
import { createUserService, DuplicateUserError } from './userService';

afterEach(() => vi.unstubAllGlobals());

const report: UserImportReport = {
  totalRows: 1,
  validRows: 1,
  errorRows: 0,
  importedRows: 0,
  rows: [],
};

const user: ManagedUser = {
  id: '6f1c0e1e-0000-4000-8000-000000000001',
  userCode: '22520001',
  fullName: 'Nguyễn Văn An',
  email: 'an.nv@truong.edu.vn',
  role: 'Student',
  dateOfBirth: null,
  className: 'KTPM2022',
  department: null,
  academicTitle: null,
  isActive: true,
  mustChangePassword: true,
  hasData: false,
};

// Giả lập một phản hồi ApiResponse; trả về mock để kiểm tra request đã gửi.
const stubFetch = (status: number, body: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const ok = (data: unknown) =>
  stubFetch(200, { success: true, message: '', data });

const sent = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    method: init.method ?? 'GET',
    body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
  };
};

const input = (overrides: Partial<UserInput> = {}): UserInput => ({
  userCode: ' 22520001 ',
  fullName: ' Nguyễn Văn An ',
  email: ' AN.NV@truong.edu.vn ',
  role: 'Student',
  dateOfBirth: '',
  className: 'KTPM2022',
  department: '',
  academicTitle: '',
  ...overrides,
});

it('lists users from GET /api/users', async () => {
  const fetchMock = ok([user]);
  await expect(createUserService().list()).resolves.toEqual([user]);
  expect(sent(fetchMock)).toMatchObject({ url: '/api/users', method: 'GET' });
});

it('creates a user with normalized fields and nulls for empty ones', async () => {
  const fetchMock = stubFetch(201, { success: true, message: '', data: user });
  await expect(createUserService().create(input())).resolves.toEqual(user);
  expect(sent(fetchMock)).toEqual({
    url: '/api/users',
    method: 'POST',
    body: {
      userCode: '22520001',
      role: 'Student',
      fullName: 'Nguyễn Văn An',
      email: 'an.nv@truong.edu.vn',
      dateOfBirth: null,
      className: 'KTPM2022',
      department: null,
      academicTitle: null,
    },
  });
});

it('updates only editable fields, never the code or role', async () => {
  const fetchMock = ok(user);
  await createUserService().update(
    user.id,
    input({ dateOfBirth: '2004-03-12' }),
  );
  const request = sent(fetchMock);
  expect(request.url).toBe(`/api/users/${user.id}`);
  expect(request.method).toBe('PUT');
  expect(request.body).toMatchObject({ dateOfBirth: '2004-03-12' });
  expect(request.body).not.toHaveProperty('userCode');
  expect(request.body).not.toHaveProperty('role');
});

it.each(['userCode', 'email'] as const)(
  'turns a 409 naming %s into a DuplicateUserError for that field',
  async (field) => {
    stubFetch(409, {
      success: false,
      message: 'Trùng',
      data: { field },
    });
    const error = await createUserService()
      .create(input())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DuplicateUserError);
    expect(error).toMatchObject({ field });
  },
);

it('keeps other API errors as they are', async () => {
  stubFetch(400, {
    success: false,
    message: 'Validation failed',
    errors: ['Nhập lớp của sinh viên.'],
  });
  const error = await createUserService()
    .update(user.id, input())
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 400,
    message: 'Nhập lớp của sinh viên.',
  });
});

it('changes status with PATCH and returns the delete outcome', async () => {
  let fetchMock = ok({ ...user, isActive: false });
  await createUserService().setActive(user.id, false);
  expect(sent(fetchMock)).toEqual({
    url: `/api/users/${user.id}/status`,
    method: 'PATCH',
    body: { isActive: false },
  });

  fetchMock = ok({ result: 'disabled' });
  await expect(createUserService().remove(user.id)).resolves.toBe('disabled');
  expect(sent(fetchMock)).toMatchObject({
    url: `/api/users/${user.id}`,
    method: 'DELETE',
  });
});

it('resets to the user code by sending null, or to a chosen password', async () => {
  let fetchMock = ok(user);
  await createUserService().resetPassword(user.id);
  expect(sent(fetchMock)).toEqual({
    url: `/api/users/${user.id}/reset-password`,
    method: 'POST',
    body: { newPassword: null },
  });

  fetchMock = ok(user);
  await createUserService().resetPassword(user.id, 'matkhau123');
  expect(sent(fetchMock).body).toEqual({ newPassword: 'matkhau123' });
});

it('posts import files as multipart form data without a JSON header', async () => {
  const csv = () => new File(['user_code\n'], 'nguoi-dung.csv');
  for (const [call, url] of [
    ['importPreview', '/api/users/import/preview'],
    ['importCommit', '/api/users/import'],
  ] as const) {
    const fetchMock = ok(report);
    await expect(createUserService()[call](csv())).resolves.toEqual(report);
    const [sentUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(sentUrl).toBe(url);
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(init.headers).not.toHaveProperty('Content-Type');
  }
});
