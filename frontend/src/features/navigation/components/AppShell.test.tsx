import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AuthService } from '@/features/auth/services/authService';
import type { CurrentUser } from '@/types/auth';
import { AppShell } from './AppShell';

const replace = vi.fn();
let pathname = '/sv';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
  pathname = '/sv';
});

const student: CurrentUser = {
  id: '1',
  userCode: '22520001',
  fullName: 'Nguyễn Văn An',
  email: 'an.nv@truong.edu.vn',
  role: 'Student',
  mustChangePassword: false,
};

const fakeAuth = (
  getCurrentUser: AuthService['getCurrentUser'],
): AuthService => ({
  login: vi.fn(),
  getCurrentUser,
  sendActivationCode: vi.fn(),
  changeInitialPassword: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
});

const renderShell = (auth: AuthService, area?: CurrentUser['role']) =>
  render(
    <AppShell authService={auth} area={area}>
      <p>Nội dung trang</p>
    </AppShell>,
  );

it('shows no menu while the session is loading', () => {
  renderShell(
    fakeAuth(() => new Promise(() => {})),
    'Student',
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đang kiểm tra phiên đăng nhập',
  );
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByText('Nội dung trang')).not.toBeInTheDocument();
});

it('sends visitors without a session to the login page', async () => {
  renderShell(fakeAuth(vi.fn().mockResolvedValue(null)), 'Student');
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('sends accounts that still must change their password to login', async () => {
  renderShell(
    fakeAuth(
      vi.fn().mockResolvedValue({ ...student, mustChangePassword: true }),
    ),
    'Student',
  );
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('moves a user out of another role area without showing its menu', async () => {
  pathname = '/giao-vu/nguoi-dung';
  renderShell(fakeAuth(vi.fn().mockResolvedValue(student)), 'AcademicAffairs');
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/sv'));
  expect(
    screen.queryByRole('link', { name: 'Người dùng' }),
  ).not.toBeInTheDocument();
});

it('renders the menu of the role returned by the auth service', async () => {
  pathname = '/sv/de-tai';
  renderShell(fakeAuth(vi.fn().mockResolvedValue(student)), 'Student');

  expect(
    await screen.findByRole('link', { name: 'Đề tài của tôi' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(screen.getByText('Nội dung trang')).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Đề xuất từ SV' }),
  ).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it('offers a retry when the session check fails', async () => {
  const getCurrentUser = vi
    .fn()
    .mockRejectedValueOnce(new Error('Máy chủ lỗi'))
    .mockResolvedValue(student);
  renderShell(fakeAuth(getCurrentUser), 'Student');

  expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ lỗi');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(
    await screen.findByRole('link', { name: 'Trang chủ' }),
  ).toBeInTheDocument();
});

it('logs out through the service and leaves the signed-in area', async () => {
  const auth = fakeAuth(vi.fn().mockResolvedValue(student));
  renderShell(auth, 'Student');

  fireEvent.click(
    await screen.findByRole('button', { name: /Tài khoản: Nguyễn Văn An/ }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));

  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  expect(auth.logout).toHaveBeenCalled();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('keeps the session when logout fails', async () => {
  const auth = fakeAuth(vi.fn().mockResolvedValue(student));
  auth.logout = vi.fn().mockRejectedValue(new Error('offline'));
  renderShell(auth, 'Student');

  fireEvent.click(
    await screen.findByRole('button', { name: /Tài khoản: Nguyễn Văn An/ }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));

  await vi.waitFor(() => expect(auth.logout).toHaveBeenCalled());
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});
