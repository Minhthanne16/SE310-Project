import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import { SessionProvider } from '@/features/auth/session/SessionProvider';
import type { AuthService } from '@/features/auth/services/authService';
import {
  createProfileService,
  type ProfileService,
} from '@/features/profile/services/profileService';
import type { CurrentUser, UserRole } from '@/types/auth';
import { ProfilePage } from './ProfilePage';

afterEach(cleanup);

const userFor = (role: UserRole): CurrentUser => ({
  id: `id-${role}`,
  userCode: 'U001',
  fullName: 'Nguyễn Văn An',
  email: 'an.nv@truong.edu.vn',
  role,
  mustChangePassword: false,
});

const fakeAuth = (
  role: UserRole,
  changePassword: AuthService['changePassword'] = vi.fn(),
): AuthService => ({
  login: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue(userFor(role)),
  sendActivationCode: vi.fn(),
  changeInitialPassword: vi.fn(),
  changePassword,
  logout: vi.fn(),
});

const renderPage = async (
  role: UserRole = 'Student',
  options: {
    service?: ProfileService;
    changePassword?: AuthService['changePassword'];
  } = {},
) => {
  const service = options.service ?? createProfileService();
  render(
    <SessionProvider authService={fakeAuth(role, options.changePassword)}>
      <ProfilePage profileService={service} />
    </SessionProvider>,
  );
  await screen.findByRole('heading', { name: 'Thông tin cá nhân' });
  return service;
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const file = (name: string, type: string, size = 1024) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

it('shows the class for a student and no lecturer fields', async () => {
  await renderPage('Student');
  expect(screen.getByText('Lớp')).toBeInTheDocument();
  expect(screen.getByText('KTPM2022')).toBeInTheDocument();
  expect(screen.queryByText('Bộ môn')).not.toBeInTheDocument();
  expect(screen.getByText('12/03/2004')).toBeInTheDocument();
  expect(screen.getByText(/do Giáo vụ quản lý/)).toBeInTheDocument();
  expect(screen.getByText(/gần nhất/)).toBeInTheDocument();
});

it('shows department and academic title for a lecturer', async () => {
  await renderPage('Lecturer');
  expect(screen.getByText('Bộ môn')).toBeInTheDocument();
  expect(screen.getByText('Học hàm')).toBeInTheDocument();
  expect(screen.queryByText('Lớp')).not.toBeInTheDocument();
});

it('shows no unit fields for academic affairs staff', async () => {
  await renderPage('AcademicAffairs');
  for (const label of ['Lớp', 'Bộ môn', 'Học hàm'])
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  expect(screen.getByText('Mã người dùng')).toBeInTheDocument();
});

it('edits and saves the profile', async () => {
  const service = await renderPage();
  const update = vi.spyOn(service, 'updateProfile');
  fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));
  expect(screen.getByLabelText('Ngày sinh')).toHaveFocus();

  type('Số điện thoại', '0912 345.678');
  type('Email phụ', 'Binh@Gmail.com');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  await waitFor(() =>
    expect(screen.getByText('0912345678')).toBeInTheDocument(),
  );
  expect(update).toHaveBeenCalledWith(
    'id-Student',
    expect.objectContaining({ phone: '0912 345.678' }),
  );
  expect(screen.getByText('0912345678')).toBeInTheDocument();
  expect(screen.getByText('binh@gmail.com')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Lưu thay đổi' }),
  ).not.toBeInTheDocument();
});

it('keeps the full name read-only under the account section', async () => {
  await renderPage();
  expect(screen.getByText('Họ tên')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));
  expect(screen.queryByLabelText('Họ tên')).not.toBeInTheDocument();
  expect(screen.getAllByText('Nguyễn Văn An').length).toBeGreaterThan(0);
});

it('cancels editing without saving', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));
  type('Số điện thoại', '0999999999');
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(screen.queryByLabelText('Số điện thoại')).not.toBeInTheDocument();
  expect(screen.queryByText('0999999999')).not.toBeInTheDocument();
});

it('reports a bad phone and bad secondary email', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));
  type('Số điện thoại', '12345');
  type('Email phụ', 'an.nv@truong.edu.vn');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  expect(screen.getByRole('alert')).toHaveTextContent('2 mục chưa hợp lệ');
  expect(
    screen.getByText('Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Email phụ phải khác email tài khoản.'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Số điện thoại')).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  type('Email phụ', 'khong-hop-le');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(screen.getByText('Email phụ không hợp lệ.')).toBeInTheDocument();
});

it('rejects an avatar with the wrong format or that is too large', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));
  const input = screen.getByLabelText('Ảnh đại diện');

  fireEvent.change(input, {
    target: { files: [file('a.gif', 'image/gif')] },
  });
  expect(screen.getByText('Ảnh phải là JPG, PNG hoặc WebP.')).toBeVisible();
  expect(input).toHaveAttribute('aria-invalid', 'true');

  fireEvent.change(input, {
    target: { files: [file('b.png', 'image/png', 3 * 1024 * 1024)] },
  });
  expect(screen.getByText('Ảnh tối đa 2 MB.')).toBeVisible();

  fireEvent.change(input, {
    target: { files: [file('c.webp', 'image/webp')] },
  });
  expect(screen.queryByText('Ảnh tối đa 2 MB.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Gỡ ảnh' })).toBeInTheDocument();
});

it('opens the change-password dialog and shows the server message', async () => {
  const changePassword = vi
    .fn()
    .mockRejectedValue(new ApiError('Mật khẩu hiện tại không đúng.', 400));
  await renderPage('Student', { changePassword });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
  const dialog = screen.getByRole('dialog', { name: 'Đổi mật khẩu' });

  fireEvent.change(within(dialog).getByLabelText('Mật khẩu hiện tại'), {
    target: { value: 'sai-mat-khau1' },
  });
  fireEvent.change(within(dialog).getByLabelText('Mật khẩu mới'), {
    target: { value: 'matkhau-moi1' },
  });
  fireEvent.change(within(dialog).getByLabelText('Nhập lại mật khẩu mới'), {
    target: { value: 'matkhau-moi1' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Đổi mật khẩu' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Mật khẩu hiện tại không đúng.',
  );

  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
