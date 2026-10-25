import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import type { AuthService } from '@/features/auth/services/authService';
import type { CurrentUser } from '@/types/auth';
import { LoginPage } from './LoginPage';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
});

const student: CurrentUser = {
  id: '1',
  userCode: '22520001',
  fullName: 'Nguyễn Văn An',
  email: 'an.nv@truong.edu.vn',
  role: 'Student',
  mustChangePassword: false,
};

// Lần gọi getCurrentUser đầu tiên (kiểm tra phiên khi mở trang) chưa có phiên.
const fakeAuth = (
  result: 'success' | 'mustChangePassword',
  user: CurrentUser = student,
): AuthService => ({
  login: vi.fn().mockResolvedValue(result),
  getCurrentUser: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(user),
  sendActivationCode: vi.fn().mockResolvedValue({
    expiresAt: '2026-10-24T08:10:00Z',
    resendAvailableAt: '2000-01-01T00:00:00Z',
  }),
  changeInitialPassword: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
});

const fillLogin = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), {
    target: { value: password },
  });
};

const startFirstLogin = async (auth: AuthService) => {
  render(<LoginPage authService={auth} />);
  fillLogin('an.nv@truong.edu.vn', '22520001');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  return screen.findByRole('button', { name: 'Đổi mật khẩu và tiếp tục' });
};

it('shows field errors when email or password is empty', () => {
  const auth = fakeAuth('success');
  render(<LoginPage authService={auth} />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  expect(screen.getByText('Nhập email.')).toBeInTheDocument();
  expect(screen.getByText('Nhập mật khẩu.')).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(screen.getByLabelText('Email')).toHaveAttribute(
    'aria-describedby',
    'email-error',
  );
  expect(auth.login).not.toHaveBeenCalled();
});

it('rejects a malformed email before calling the service', () => {
  const auth = fakeAuth('success');
  render(<LoginPage authService={auth} />);
  fillLogin('an.nv', 'matkhau123');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  expect(screen.getByText('Email không đúng định dạng.')).toBeInTheDocument();
  expect(auth.login).not.toHaveBeenCalled();
});

it('signs in and hands over the authenticated user', async () => {
  const auth = fakeAuth('success');
  const onAuthenticated = vi.fn();
  render(<LoginPage authService={auth} onAuthenticated={onAuthenticated} />);
  fillLogin(' an.nv@truong.edu.vn ', 'matkhau123');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(student));
  expect(auth.login).toHaveBeenCalledWith('an.nv@truong.edu.vn', 'matkhau123');
});

it('redirects to the role home page after signing in', async () => {
  const lecturer: CurrentUser = { ...student, role: 'Lecturer' };
  render(<LoginPage authService={fakeAuth('success', lecturer)} />);
  fillLogin('gv@truong.edu.vn', 'matkhau123');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/gv'));
});

it('redirects a user who already has a valid session', async () => {
  const auth = fakeAuth('success');
  auth.getCurrentUser = vi.fn().mockResolvedValue(student);
  render(<LoginPage authService={auth} />);

  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/sv'));
});

it('shows one generic message for wrong credentials', async () => {
  const auth = fakeAuth('success');
  auth.login = vi
    .fn()
    .mockRejectedValue(new ApiError('Email hoặc mật khẩu không đúng.', 401));
  render(<LoginPage authService={auth} />);
  fillLogin('an.nv@truong.edu.vn', 'sai12345');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Email hoặc mật khẩu không đúng.',
  );
  expect(screen.getByLabelText('Email')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

it('explains a network failure', async () => {
  const auth = fakeAuth('success');
  auth.login = vi
    .fn()
    .mockRejectedValue(new ApiError('Không kết nối được máy chủ.', 0));
  render(<LoginPage authService={auth} />);
  fillLogin('an.nv@truong.edu.vn', 'matkhau123');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Không kết nối được máy chủ.',
  );
});

it('does not send a second login request while one is pending', async () => {
  const auth = fakeAuth('success');
  auth.login = vi.fn(() => new Promise<never>(() => {}));
  render(<LoginPage authService={auth} />);
  fillLogin('an.nv@truong.edu.vn', 'matkhau123');

  const form = screen
    .getByRole('button', { name: 'Đăng nhập' })
    .closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);

  expect(
    await screen.findByRole('button', { name: 'Đang đăng nhập...' }),
  ).toBeDisabled();
  expect(auth.login).toHaveBeenCalledTimes(1);
});

it('toggles password visibility', () => {
  render(<LoginPage authService={fakeAuth('success')} />);
  const input = screen.getByLabelText('Mật khẩu');
  expect(input).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('asks for a new password on first login and enables submit once rules pass', async () => {
  const auth = fakeAuth('mustChangePassword');
  const onAuthenticated = vi.fn();
  render(<LoginPage authService={auth} onAuthenticated={onAuthenticated} />);
  fillLogin('an.nv@truong.edu.vn', '22520001');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  const submit = await screen.findByRole('button', {
    name: 'Đổi mật khẩu và tiếp tục',
  });
  expect(submit).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
    target: { value: 'matkhau123' },
  });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
    target: { value: 'matkhau123' },
  });
  // Mật khẩu đã hợp lệ nhưng chưa có mã xác thực 6 số.
  expect(submit).toBeDisabled();
  expect(auth.sendActivationCode).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText('Mã xác thực'), {
    target: { value: '12345' },
  });
  expect(submit).toBeDisabled();
  expect(screen.getByLabelText('Mã xác thực')).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  fireEvent.change(screen.getByLabelText('Mã xác thực'), {
    target: { value: '123456' },
  });
  expect(submit).toBeEnabled();

  fireEvent.click(submit);
  await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(student));
  expect(auth.changeInitialPassword).toHaveBeenCalledWith(
    '22520001',
    'matkhau123',
    '123456',
  );
});

it('keeps submit disabled when the confirmation does not match', async () => {
  const submit = await startFirstLogin(fakeAuth('mustChangePassword'));
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
    target: { value: 'matkhau123' },
  });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
    target: { value: 'matkhau124' },
  });
  fireEvent.change(screen.getByLabelText('Mã xác thực'), {
    target: { value: '123456' },
  });
  expect(submit).toBeDisabled();
  expect(screen.getByLabelText('Nhập lại mật khẩu mới')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

it('shows the error when the activation code is wrong or expired', async () => {
  const auth = fakeAuth('mustChangePassword');
  auth.changeInitialPassword = vi
    .fn()
    .mockRejectedValue(
      new ApiError('Mã xác thực đã hết hạn hoặc chưa được gửi.', 400),
    );
  const onAuthenticated = vi.fn();
  render(<LoginPage authService={auth} onAuthenticated={onAuthenticated} />);
  fillLogin('an.nv@truong.edu.vn', '22520001');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  const submit = await screen.findByRole('button', {
    name: 'Đổi mật khẩu và tiếp tục',
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
    target: { value: 'matkhau123' },
  });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
    target: { value: 'matkhau123' },
  });
  fireEvent.change(screen.getByLabelText('Mã xác thực'), {
    target: { value: '000000' },
  });
  fireEvent.click(submit);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Mã xác thực đã hết hạn hoặc chưa được gửi.',
  );
  expect(onAuthenticated).not.toHaveBeenCalled();
});

it('returns to sign-in when the session expires during the code step', async () => {
  const auth = fakeAuth('mustChangePassword');
  auth.sendActivationCode = vi
    .fn()
    .mockRejectedValue(new ApiError('Bạn cần đăng nhập để tiếp tục', 401));
  render(<LoginPage authService={auth} />);
  fillLogin('an.nv@truong.edu.vn', '22520001');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Phiên đăng nhập đã hết hạn',
  );
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
});

it('blocks resending until the cooldown from the service ends', async () => {
  const auth = fakeAuth('mustChangePassword');
  auth.sendActivationCode = vi.fn().mockResolvedValue({
    expiresAt: '2099-01-01T00:10:00Z',
    resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await startFirstLogin(auth);

  const resend = await screen.findByRole('button', { name: 'Gửi lại mã' });
  await vi.waitFor(() => expect(resend).toBeDisabled());
  expect(resend).toHaveTextContent(/Gửi lại mã \(\d+s\)/);
  fireEvent.click(resend);
  expect(auth.sendActivationCode).toHaveBeenCalledTimes(1);
});

it('resends the activation code once the cooldown has passed', async () => {
  const auth = fakeAuth('mustChangePassword');
  await startFirstLogin(auth);

  const resend = await screen.findByRole('button', { name: 'Gửi lại mã' });
  await vi.waitFor(() => expect(resend).toBeEnabled());
  fireEvent.click(resend);

  await vi.waitFor(() =>
    expect(auth.sendActivationCode).toHaveBeenCalledTimes(2),
  );
});

it('clears the session when the user logs out from the change-password step', async () => {
  const auth = fakeAuth('mustChangePassword');
  await startFirstLogin(auth);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

  await screen.findByRole('button', { name: 'Đăng nhập' });
  expect(auth.logout).toHaveBeenCalled();
});
