import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/features/auth/session/SessionProvider';
import type { AuthService } from '@/features/auth/services/authService';
import {
  createProfileService,
  type ProfileService,
} from '@/features/profile/services/profileService';
import type { CurrentUser } from '@/types/auth';
import { ProfilePage } from './ProfilePage';

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

afterEach(() => {
  cleanup();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

const me: CurrentUser = {
  id: 'id-1',
  userCode: 'U001',
  fullName: 'Nguyễn Văn An',
  email: 'an.nv@truong.edu.vn',
  role: 'Student',
  mustChangePassword: false,
};

const fakeAuth = (): AuthService => ({
  login: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue(me),
  sendActivationCode: vi.fn(),
  changeInitialPassword: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
});

const renderPage = async (service: ProfileService = createProfileService()) => {
  render(
    <SessionProvider authService={fakeAuth()}>
      <ProfilePage profileService={service} />
    </SessionProvider>,
  );
  await screen.findByRole('heading', { name: 'Hồ sơ cá nhân' });
  return service;
};

const ready = () => screen.findByRole('heading', { name: 'Thông tin cá nhân' });

const stubBlobUrls = () => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
};

const file = (name: string, type: string) => new File(['x'], name, { type });

const edit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));

const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

const waitSaved = () =>
  waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Lưu thay đổi' }),
    ).not.toBeInTheDocument(),
  );

it('returns focus to the edit button after cancel, Escape and save', async () => {
  await renderPage();
  await ready();
  edit();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(screen.getByRole('button', { name: 'Sửa hồ sơ' })).toHaveFocus();

  edit();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Sửa hồ sơ' })).toHaveFocus();

  edit();
  save();
  await waitSaved();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Sửa hồ sơ' })).toHaveFocus(),
  );
});

it('keeps the edit form open when Escape closes the password dialog', async () => {
  await renderPage();
  await ready();
  edit();
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Ngày sinh')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByLabelText('Ngày sinh')).not.toBeInTheDocument();
});

it('previews a valid avatar, keeps it after a rejected pick, saves and removes it', async () => {
  stubBlobUrls();
  await renderPage();
  await ready();
  edit();
  const input = screen.getByLabelText('Ảnh đại diện');
  fireEvent.change(input, { target: { files: [file('a.png', 'image/png')] } });
  expect(screen.getByRole('img')).toBeInTheDocument();

  fireEvent.change(input, { target: { files: [file('b.gif', 'image/gif')] } });
  expect(screen.getByText('Ảnh phải là JPG, PNG hoặc WebP.')).toBeVisible();
  expect(input).toHaveAttribute(
    'aria-describedby',
    'profile-avatar-hint profile-avatar-error',
  );
  expect(screen.getByRole('img')).toBeInTheDocument();

  save();
  await waitSaved();
  expect(screen.getByRole('img')).toBeInTheDocument();

  edit();
  fireEvent.click(screen.getByRole('button', { name: 'Gỡ ảnh' }));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  save();
  await waitSaved();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getAllByText('NA').length).toBeGreaterThan(0);
});

it('keeps the form open and shows the error when saving fails', async () => {
  const service = createProfileService();
  vi.spyOn(service, 'updateProfile').mockRejectedValue(
    new Error('Máy chủ từ chối.'),
  );
  await renderPage(service);
  await ready();
  edit();
  save();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Máy chủ từ chối.',
  );
  expect(screen.getByLabelText('Ngày sinh')).toBeInTheDocument();
});

it('shows the message when the profile cannot be loaded', async () => {
  const service = createProfileService();
  vi.spyOn(service, 'getProfile').mockRejectedValue(new Error('Hồ sơ lỗi.'));
  await renderPage(service);
  expect(await screen.findByText('Hồ sơ lỗi.')).toBeInTheDocument();
});
