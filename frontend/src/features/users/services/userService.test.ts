import { afterEach, expect, it, vi } from 'vitest';
import type { UserImportReport, UserInput } from '@/types/user';
import { createUserService, DuplicateUserError } from './userService';

afterEach(() => vi.unstubAllGlobals());

const report: UserImportReport = {
  totalRows: 2,
  validRows: 1,
  errorRows: 1,
  importedRows: 1,
  rows: [
    {
      rowNumber: 2,
      userCode: '23520100',
      fullName: 'Phan Mai',
      email: 'mai.p@truong.edu.vn',
      role: 'Student',
      dateOfBirth: '2005-01-02',
      className: 'KTPM2023',
      department: null,
      academicTitle: null,
      errors: [],
    },
    {
      rowNumber: 3,
      userCode: 'bad code',
      fullName: 'Lỗi',
      email: 'x',
      role: 'Student',
      dateOfBirth: null,
      className: null,
      department: null,
      academicTitle: null,
      errors: ['Mã người dùng không hợp lệ.'],
    },
  ],
};

const stubFetch = () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: '', data: report }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const csv = () => new File(['user_code\n'], 'nguoi-dung.csv');

it('posts the preview file as multipart form data without a JSON header', async () => {
  const fetchMock = stubFetch();
  await expect(createUserService().importPreview(csv())).resolves.toEqual(
    report,
  );

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/users/import/preview');
  expect(init.method).toBe('POST');
  expect(init.body).toBeInstanceOf(FormData);
  expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  expect(init.headers).not.toHaveProperty('Content-Type');
});

it('adds only the valid imported rows to the demo list', async () => {
  const fetchMock = stubFetch();
  const service = createUserService();
  const before = (await service.list()).length;

  await service.importCommit(csv());

  expect(fetchMock.mock.calls[0][0]).toBe('/api/users/import');
  const after = await service.list();
  expect(after).toHaveLength(before + 1);
  expect(after.find((u) => u.userCode === '23520100')).toMatchObject({
    role: 'Student',
    className: 'KTPM2023',
    mustChangePassword: true,
  });
});

const input = (overrides: Partial<UserInput>): UserInput => ({
  userCode: 'NEW01',
  fullName: 'Người Mới',
  email: 'moi@truong.edu.vn',
  role: 'Student',
  dateOfBirth: '',
  className: 'KTPM2024',
  department: '',
  academicTitle: '',
  ...overrides,
});

it('rejects duplicate codes and emails when creating and updating', async () => {
  const service = createUserService();
  await expect(
    service.create(input({ userCode: '22520001' })),
  ).rejects.toMatchObject({ field: 'userCode' });
  await expect(
    service.create(input({ email: 'AN.NV@truong.edu.vn' })),
  ).rejects.toBeInstanceOf(DuplicateUserError);

  const created = await service.create(input({}));
  await expect(
    service.update(created.id, input({ email: 'an.nv@truong.edu.vn' })),
  ).rejects.toMatchObject({ field: 'email' });
});

it('deletes users without data and disables users that have data', async () => {
  const service = createUserService();
  const users = await service.list();
  const withData = users.find((u) => u.hasData && u.isActive)!;
  const noData = users.find((u) => !u.hasData && u.isActive)!;

  await expect(service.remove(noData.id)).resolves.toBe('deleted');
  await expect(service.remove(withData.id)).resolves.toBe('disabled');

  const after = await service.list();
  expect(after.find((u) => u.id === noData.id)).toBeUndefined();
  expect(after.find((u) => u.id === withData.id)?.isActive).toBe(false);
});
