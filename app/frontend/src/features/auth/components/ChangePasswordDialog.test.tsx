import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import type { AuthService } from '@/features/auth/services/authService';
import { ChangePasswordDialog } from './ChangePasswordDialog';

afterEach(cleanup);

const fakeAuth = (): AuthService => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  sendActivationCode: vi.fn(),
  changeInitialPassword: vi.fn(),
  changePassword: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(),
});

const renderDialog = (auth = fakeAuth()) => {
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(
    <ChangePasswordDialog
      authService={auth}
      onChanged={onChanged}
      onClose={onClose}
    />,
  );
  return { auth, onChanged, onClose };
};

const fill = (current: string, next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
    target: { value: confirm },
  });
};

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

it('is an accessible modal dialog focused on the first field', () => {
  renderDialog();
  expect(screen.getByRole('dialog', { name: 'Đổi mật khẩu' })).toHaveAttribute(
    'aria-modal',
    'true',
  );
  expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveFocus();
});

it('requires the current password', () => {
  const { auth } = renderDialog();
  fill('', 'matkhau123', 'matkhau123');
  submit();
  expect(screen.getByText('Nhập mật khẩu hiện tại.')).toBeInTheDocument();
  expect(auth.changePassword).not.toHaveBeenCalled();
});

it('does not submit a password that breaks the rules', () => {
  const { auth } = renderDialog();
  fill('demo1234', 'abcdefgh', 'abcdefgh');
  submit();
  expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(auth.changePassword).not.toHaveBeenCalled();
});

it('reports a confirmation mismatch under the field', () => {
  const { auth } = renderDialog();
  fill('demo1234', 'matkhau123', 'matkhau124');
  submit();
  expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeInTheDocument();
  expect(screen.getByLabelText('Nhập lại mật khẩu mới')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(auth.changePassword).not.toHaveBeenCalled();
});

it('rejects a new password equal to the current one', () => {
  const { auth } = renderDialog();
  fill('matkhau123', 'matkhau123', 'matkhau123');
  submit();
  expect(auth.changePassword).not.toHaveBeenCalled();
});

it('shows the error when the current password is wrong', async () => {
  const auth = fakeAuth();
  auth.changePassword = vi
    .fn()
    .mockRejectedValue(new ApiError('Mật khẩu hiện tại không đúng', 400));
  const { onChanged } = renderDialog(auth);
  fill('sai12345', 'matkhau123', 'matkhau123');
  submit();

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Mật khẩu hiện tại không đúng',
  );
  expect(onChanged).not.toHaveBeenCalled();
});

it('changes the password through the regular endpoint only', async () => {
  const { auth, onChanged } = renderDialog();
  fill('demo1234', 'matkhau123', 'matkhau123');
  submit();

  await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(auth.changePassword).toHaveBeenCalledWith('demo1234', 'matkhau123');
  expect(auth.changeInitialPassword).not.toHaveBeenCalled();
});

it('closes on Escape', () => {
  const { onClose } = renderDialog();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});
