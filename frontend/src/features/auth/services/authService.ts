import { ApiError, apiRequest } from '@/api/request';
import type { ActivationCodeSent, CurrentUser } from '@/types/auth';

export type LoginResult = 'success' | 'mustChangePassword';

// Hợp đồng chung cho mọi cài đặt xác thực (API thật hoặc mock demo).
// Component chỉ phụ thuộc interface này, nên đổi cài đặt không phải sửa UI.
export interface AuthService {
  login(email: string, password: string): Promise<LoginResult>;
  // Trả null khi chưa có phiên hợp lệ (401).
  getCurrentUser(): Promise<CurrentUser | null>;
  sendActivationCode(): Promise<ActivationCodeSent>;
  changeInitialPassword(
    currentPassword: string,
    newPassword: string,
    activationCode: string,
  ): Promise<void>;
  // Đổi mật khẩu thông thường (Hồ sơ cá nhân), khác đổi mật khẩu lần đầu.
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

export const CHANGE_PASSWORD_UNAVAILABLE =
  'Backend chưa có API đổi mật khẩu thông thường.';

// Phiên đăng nhập là JWT trong cookie HttpOnly do backend đặt; frontend không
// đọc hay lưu token, trình duyệt tự gửi cookie qua proxy /api cùng origin.
export const authService: AuthService = {
  async login(email, password) {
    const user = await apiRequest<CurrentUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return user.mustChangePassword ? 'mustChangePassword' : 'success';
  },

  async getCurrentUser() {
    try {
      return await apiRequest<CurrentUser>('/auth/me');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  // Gửi OTP kích hoạt tới email của tài khoản đang đăng nhập (lần đầu).
  async sendActivationCode() {
    return apiRequest<ActivationCodeSent>('/auth/activation-code', {
      method: 'POST',
    });
  },

  async changeInitialPassword(currentPassword, newPassword, activationCode) {
    await apiRequest<CurrentUser>('/auth/change-initial-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, activationCode }),
    });
  },

  // Chưa có endpoint. Hợp đồng đề xuất cho backend:
  // POST /api/auth/change-password { currentPassword, newPassword }
  // → 200 ApiResponse<CurrentUserDto> + cookie mới; 400 sai mật khẩu hiện tại
  // hoặc vi phạm quy tắc; 401 hết phiên. Không dùng change-initial-password.
  async changePassword() {
    throw new ApiError(CHANGE_PASSWORD_UNAVAILABLE, 501);
  },

  async logout() {
    await apiRequest<boolean>('/auth/logout', { method: 'POST' });
  },
};

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/auth/me');
}
