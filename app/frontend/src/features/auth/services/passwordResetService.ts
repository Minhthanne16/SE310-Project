import { ApiError, apiRequest } from '@/api/request';

// Trạng thái liên kết đặt lại mật khẩu do backend trả (PDR-052).
export type ResetLinkStatus = 'valid' | 'expired' | 'used' | 'invalid';

// Liên kết không còn dùng được khi đặt mật khẩu mới; status cho trang biết hiện màn nào.
export class ResetLinkError extends Error {
  readonly status: Exclude<ResetLinkStatus, 'valid'>;

  constructor(status: Exclude<ResetLinkStatus, 'valid'>, message: string) {
    super(message);
    this.name = 'ResetLinkError';
    this.status = status;
  }
}

export interface PasswordResetService {
  // Luôn nhận cùng phản hồi trung tính với email đúng định dạng (PDR-037).
  requestLink(email: string): Promise<void>;
  checkLink(token: string): Promise<ResetLinkStatus>;
  // Ném ResetLinkError khi liên kết hết hạn/đã dùng/không hợp lệ, ApiError khi mật khẩu sai quy tắc.
  resetPassword(token: string, newPassword: string): Promise<void>;
}

const isLinkStatus = (
  value: unknown,
): value is Exclude<ResetLinkStatus, 'valid'> =>
  value === 'expired' || value === 'used' || value === 'invalid';

export function createPasswordResetService(): PasswordResetService {
  return {
    // POST /api/auth/forgot-password { email } → 200 trung tính; 400 khi sai định dạng.
    async requestLink(email) {
      await apiRequest<boolean>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    // POST /api/auth/reset-password/check { token } → { status }.
    async checkLink(token) {
      const { status } = await apiRequest<{ status: ResetLinkStatus }>(
        '/auth/reset-password/check',
        { method: 'POST', body: JSON.stringify({ token }) },
      );
      return status;
    },

    // POST /api/auth/reset-password { token, newPassword }; 400 kèm data.status khi liên kết hỏng.
    async resetPassword(token, newPassword) {
      try {
        await apiRequest<{ status: string }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, newPassword }),
        });
      } catch (err: unknown) {
        const status =
          err instanceof ApiError
            ? (err.data as { status?: unknown } | null)?.status
            : undefined;
        if (err instanceof ApiError && isLinkStatus(status))
          throw new ResetLinkError(status, err.message);
        throw err;
      }
    },
  };
}

export const passwordResetService: PasswordResetService =
  createPasswordResetService();
