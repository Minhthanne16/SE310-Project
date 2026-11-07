import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import {
  ResetLinkError,
  type PasswordResetService,
} from '@/features/auth/services/passwordResetService';
import { ForgotPasswordPage, NEUTRAL_MESSAGE } from './ForgotPasswordPage';

beforeEach(() => window.history.replaceState(null, '', '/quen-mat-khau'));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fakeService = (
  overrides: Partial<PasswordResetService> = {},
): PasswordResetService => ({
  requestLink: vi.fn().mockResolvedValue(undefined),
  checkLink: vi.fn().mockResolvedValue('valid'),
  resetPassword: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const openWithToken = (token: string) =>
  window.history.replaceState(null, '', `/quen-mat-khau#token=${token}`);

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

it('checks the email format before sending and never asks the server for a bad one', async () => {
  const service = fakeService();
  render(<ForgotPasswordPage passwordResetService={service} />);

  type('Email', 'khong-phai-email');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }));

  expect(
    await screen.findByText('Email không đúng định dạng.'),
  ).toBeInTheDocument();
  expect(service.requestLink).not.toHaveBeenCalled();
});

it('shows the neutral message after a request and waits 60 seconds before resending', async () => {
  const service = fakeService();
  render(<ForgotPasswordPage passwordResetService={service} />);

  type('Email', ' an@truong.edu.vn ');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }));

  expect(await screen.findByText(NEUTRAL_MESSAGE)).toBeInTheDocument();
  expect(service.requestLink).toHaveBeenCalledWith('an@truong.edu.vn');
  expect(screen.queryByText(/không tồn tại/)).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /Gửi lại liên kết \(\d+s\)/ }),
  ).toBeDisabled();
});

it('lets the resend button work again once the countdown ends', async () => {
  const service = fakeService();
  render(<ForgotPasswordPage passwordResetService={service} />);
  type('Email', 'an@truong.edu.vn');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }));
  await screen.findByText(NEUTRAL_MESSAGE);

  // Đồng hồ nhảy qua 60 giây; lần đếm kế tiếp (mỗi giây) mở lại nút.
  const later = Date.now() + 61_000;
  vi.spyOn(Date, 'now').mockReturnValue(later);
  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: 'Gửi lại liên kết' },
      { timeout: 3000 },
    ),
  );
  await act(async () => {});
  expect(service.requestLink).toHaveBeenCalledTimes(2);
});

it('sets a new password from a valid link and removes the token from the address bar', async () => {
  openWithToken('abc123');
  const service = fakeService();
  render(<ForgotPasswordPage passwordResetService={service} />);

  expect(
    await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' }),
  ).toBeInTheDocument();
  expect(service.checkLink).toHaveBeenCalledWith('abc123');
  expect(window.location.hash).toBe('');

  const submit = screen.getByRole('button', { name: 'Đặt mật khẩu mới' });
  type('Mật khẩu mới', 'MatKhauMoi9');
  type('Nhập lại mật khẩu mới', 'MatKhauMoi');
  expect(submit).toBeDisabled();
  type('Nhập lại mật khẩu mới', 'MatKhauMoi9');
  fireEvent.click(submit);

  expect(
    await screen.findByRole('heading', { name: 'Đã đổi mật khẩu' }),
  ).toBeInTheDocument();
  expect(service.resetPassword).toHaveBeenCalledWith('abc123', 'MatKhauMoi9');
  expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
    'href',
    '/login',
  );
});

it('keeps the link when React runs effects twice in development', async () => {
  openWithToken('strict1');
  const service = fakeService();
  render(
    <StrictMode>
      <ForgotPasswordPage passwordResetService={service} />
    </StrictMode>,
  );

  expect(
    await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' }),
  ).toBeInTheDocument();
  expect(service.checkLink).toHaveBeenCalledWith('strict1');
});

it('reads a link pasted into a tab that already shows the page', async () => {
  const service = fakeService();
  render(<ForgotPasswordPage passwordResetService={service} />);
  await screen.findByRole('heading', { name: 'Quên mật khẩu' });

  // Chỉ phần # đổi nên trình duyệt không tải lại trang, chỉ phát hashchange.
  act(() => {
    openWithToken('pasted1');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  expect(
    await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' }),
  ).toBeInTheDocument();
  expect(service.checkLink).toHaveBeenCalledWith('pasted1');
  expect(window.location.hash).toBe('');
});

it.each([
  ['expired', 'Liên kết đã hết hạn'],
  ['used', 'Liên kết đã được dùng'],
  ['invalid', 'Liên kết không còn hiệu lực'],
] as const)(
  'shows the %s link state with a way to ask for a new link',
  async (status, title) => {
    openWithToken('abc123');
    render(
      <ForgotPasswordPage
        passwordResetService={fakeService({
          checkLink: vi.fn().mockResolvedValue(status),
        })}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết mới' }));
    expect(
      screen.getByRole('heading', { name: 'Quên mật khẩu' }),
    ).toBeInTheDocument();
  },
);

it('switches to the used state when the link is consumed while the form is open', async () => {
  openWithToken('abc123');
  render(
    <ForgotPasswordPage
      passwordResetService={fakeService({
        resetPassword: vi
          .fn()
          .mockRejectedValue(new ResetLinkError('used', 'Đã dùng')),
      })}
    />,
  );
  await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' });
  type('Mật khẩu mới', 'MatKhauMoi9');
  type('Nhập lại mật khẩu mới', 'MatKhauMoi9');
  fireEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));

  expect(
    await screen.findByRole('heading', { name: 'Liên kết đã được dùng' }),
  ).toBeInTheDocument();
});

it('keeps the form and shows the server rule error', async () => {
  openWithToken('abc123');
  render(
    <ForgotPasswordPage
      passwordResetService={fakeService({
        resetPassword: vi
          .fn()
          .mockRejectedValue(
            new ApiError('Mật khẩu mới phải khác mã người dùng.', 400),
          ),
      })}
    />,
  );
  await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' });
  type('Mật khẩu mới', 'sv22520001');
  type('Nhập lại mật khẩu mới', 'sv22520001');
  fireEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Mật khẩu mới phải khác mã người dùng.',
  );
  expect(
    screen.getByRole('heading', { name: 'Đặt mật khẩu mới' }),
  ).toBeInTheDocument();
});
