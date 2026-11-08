import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import {
  createPasswordResetService,
  ResetLinkError,
} from './passwordResetService';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (status: number, body: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const sent = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: JSON.parse(init.body as string) };
};

it('requests a link with the email', async () => {
  const fetchMock = stubFetch(200, {
    success: true,
    message: 'Nếu email thuộc hệ thống, bạn sẽ nhận liên kết đặt lại mật khẩu.',
    data: true,
  });
  await createPasswordResetService().requestLink('an@truong.edu.vn');
  expect(sent(fetchMock)).toEqual({
    url: '/api/auth/forgot-password',
    method: 'POST',
    body: { email: 'an@truong.edu.vn' },
  });
});

it('surfaces the format error of a malformed email', async () => {
  stubFetch(400, {
    success: false,
    message: 'Validation failed',
    errors: ['Email không đúng định dạng.'],
  });
  await expect(createPasswordResetService().requestLink('sai')).rejects.toThrow(
    'Email không đúng định dạng.',
  );
});

it('checks a link and returns its status', async () => {
  const fetchMock = stubFetch(200, {
    success: true,
    message: '',
    data: { status: 'expired', expiresAt: null },
  });
  await expect(createPasswordResetService().checkLink('abc')).resolves.toBe(
    'expired',
  );
  expect(sent(fetchMock)).toEqual({
    url: '/api/auth/reset-password/check',
    method: 'POST',
    body: { token: 'abc' },
  });
});

it('resets the password with the token', async () => {
  const fetchMock = stubFetch(200, {
    success: true,
    message: 'Đã đặt lại mật khẩu.',
    data: { status: 'completed' },
  });
  await createPasswordResetService().resetPassword('abc', 'MatKhauMoi9');
  expect(sent(fetchMock).body).toEqual({
    token: 'abc',
    newPassword: 'MatKhauMoi9',
  });
});

it('turns a link failure into ResetLinkError and keeps other errors', async () => {
  stubFetch(400, {
    success: false,
    message: 'Liên kết đặt lại mật khẩu đã được dùng.',
    data: { status: 'used' },
  });
  const error = await createPasswordResetService()
    .resetPassword('abc', 'MatKhauMoi9')
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ResetLinkError);
  expect((error as ResetLinkError).status).toBe('used');

  stubFetch(400, {
    success: false,
    message: 'Validation failed',
    errors: ['Mật khẩu mới phải có số.'],
  });
  const ruleError = await createPasswordResetService()
    .resetPassword('abc', 'chiCoChu')
    .catch((e: unknown) => e);
  expect(ruleError).toBeInstanceOf(ApiError);
  expect(ruleError).not.toBeInstanceOf(ResetLinkError);
  expect((ruleError as Error).message).toBe('Mật khẩu mới phải có số.');
});
