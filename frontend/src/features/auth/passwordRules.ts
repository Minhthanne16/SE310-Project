export interface PasswordRule {
  label: string;
  passed: boolean;
}

export const isValidPassword = (password: string): boolean =>
  password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

// Quy tắc mật khẩu mới: mặc định cho đổi mật khẩu lần đầu (khác mã người dùng);
// đổi mật khẩu thông thường truyền nhãn "Khác mật khẩu hiện tại".
export function getNewPasswordRules(
  newPassword: string,
  confirmPassword: string,
  initialPassword: string,
  differentLabel = 'Khác mật khẩu ban đầu (mã người dùng)',
): PasswordRule[] {
  return [
    { label: 'Tối thiểu 8 ký tự', passed: newPassword.length >= 8 },
    {
      label: 'Có cả chữ và số',
      passed: /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword),
    },
    {
      label: differentLabel,
      passed: newPassword !== '' && newPassword !== initialPassword,
    },
    {
      label: 'Hai lần nhập khớp nhau',
      passed: newPassword !== '' && newPassword === confirmPassword,
    },
  ];
}
