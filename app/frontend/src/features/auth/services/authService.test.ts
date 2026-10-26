import { afterEach, expect, it, vi } from 'vitest';
import { authService } from './authService';

afterEach(() => vi.unstubAllGlobals());

const user = (mustChangePassword: boolean) => ({
  id: '1',
  userCode: '22520001',
  fullName: 'Nguyễn Văn An',
  email: 'an.nv@truong.edu.vn',
  role: 'Student',
  mustChangePassword,
});

const stubFetch = (response: {
  ok: boolean;
  status?: number;
  body: unknown;
}) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    json: async () => response.body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

it('logs in through the API proxy and reports a completed login', async () => {
  const fetchMock = stubFetch({
    ok: true,
    body: { success: true, message: '', data: user(false) },
  });

  await expect(
    authService.login('an.nv@truong.edu.vn', 'matkhau123'),
  ).resolves.toBe('success');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'an.nv@truong.edu.vn',
        password: 'matkhau123',
      }),
    }),
  );
});

it('reports when the account must change its initial password', async () => {
  stubFetch({
    ok: true,
    body: { success: true, message: '', data: user(true) },
  });

  await expect(
    authService.login('an.nv@truong.edu.vn', '22520001'),
  ).resolves.toBe('mustChangePassword');
});

it('surfaces the generic invalid-credentials message from the API', async () => {
  stubFetch({
    ok: false,
    status: 401,
    body: { success: false, message: 'Email hoặc mật khẩu không đúng.' },
  });

  await expect(authService.login('an.nv@truong.edu.vn', 'sai')).rejects.toThrow(
    'Email hoặc mật khẩu không đúng.',
  );
});

it('sends the current and new password when changing the initial password', async () => {
  const fetchMock = stubFetch({
    ok: true,
    body: { success: true, message: '', data: user(false) },
  });

  await authService.changeInitialPassword('22520001', 'matkhau123', '123456');

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/auth/change-initial-password',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        currentPassword: '22520001',
        newPassword: 'matkhau123',
        activationCode: '123456',
      }),
    }),
  );
});

it('requests an activation code email', async () => {
  const sent = {
    expiresAt: '2026-10-24T08:10:00Z',
    resendAvailableAt: '2026-10-24T08:01:00Z',
  };
  const fetchMock = stubFetch({
    ok: true,
    body: { success: true, message: '', data: sent },
  });

  await expect(authService.sendActivationCode()).resolves.toEqual(sent);
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/auth/activation-code',
    expect.objectContaining({ method: 'POST' }),
  );
});

it('surfaces the resend cooldown message', async () => {
  stubFetch({
    ok: false,
    status: 429,
    body: { success: false, message: 'Vui lòng đợi 42 giây' },
  });

  await expect(authService.sendActivationCode()).rejects.toThrow(
    'Vui lòng đợi 42 giây',
  );
});

it('returns no user when the session is missing or expired', async () => {
  stubFetch({
    ok: false,
    status: 401,
    body: { success: false, message: 'Bạn cần đăng nhập để tiếp tục' },
  });

  await expect(authService.getCurrentUser()).resolves.toBeNull();
});

it('returns the current user with its role from the API', async () => {
  const fetchMock = stubFetch({
    ok: true,
    body: { success: true, message: '', data: user(false) },
  });

  await expect(authService.getCurrentUser()).resolves.toMatchObject({
    role: 'Student',
  });
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.anything());
});

it('reports a network failure with status 0', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

  await expect(authService.login('a@b.vn', 'matkhau123')).rejects.toMatchObject(
    { status: 0, message: expect.stringContaining('Không kết nối được') },
  );
});

it('never reuses the first-login endpoint for a regular password change', async () => {
  const fetchMock = stubFetch({ ok: true, body: { success: true } });

  await expect(
    authService.changePassword('matkhau123', 'matkhau456'),
  ).rejects.toThrow('Backend chưa có API đổi mật khẩu thông thường.');
  expect(fetchMock).not.toHaveBeenCalled();
});
