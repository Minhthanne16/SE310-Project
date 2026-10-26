import { normalizePhone } from '@/features/profile/profileValidation';
import type { CurrentUser } from '@/types/auth';
import type { ProfileInput, UserProfile } from '@/types/profile';

// Hợp đồng chung của Hồ sơ cá nhân (API thật hoặc demo).
export interface ProfileService {
  getProfile(user: CurrentUser): Promise<UserProfile>;
  updateProfile(userId: string, input: ProfileInput): Promise<UserProfile>;
}

const HOUR = 3_600_000;

// Giá trị demo cho các trường backend có ở thực thể User nhưng /api/auth/me
// chưa trả về (lớp, bộ môn, học hàm, lần đăng nhập cuối).
function seedProfile(user: CurrentUser): UserProfile {
  const now = Date.now();
  return {
    dateOfBirth: user.role === 'Student' ? '2004-03-12' : null,
    phone: '',
    secondaryEmail: '',
    avatarUrl: null,
    className: user.role === 'Student' ? 'KTPM2022' : null,
    department: user.role === 'Lecturer' ? 'Công nghệ phần mềm' : null,
    academicTitle: user.role === 'Lecturer' ? 'TS.' : null,
    lastLogins: [now - HOUR, now - 26 * HOUR, now - 74 * HOUR].map((t) =>
      new Date(t).toISOString(),
    ),
  };
}

// DEMO: backend chưa có API hồ sơ (chỉ có GET /api/auth/me). Kho trong bộ nhớ
// theo id người dùng, mất khi tải lại trang. Endpoint đề xuất:
// - getProfile    → GET /api/profile (hoặc mở rộng /api/auth/me)
// - updateProfile → PUT /api/profile { dateOfBirth, phone, secondaryEmail }
// - ảnh đại diện  → PUT /api/profile/avatar (multipart); DELETE cùng đường dẫn để gỡ.
//   Backend phải kiểm tra magic bytes của tệp và mã hóa lại ảnh trước khi lưu.
// Họ tên không sửa được ở đây: do Giáo vụ quản lý, lấy từ /api/auth/me.
export function createProfileService(): ProfileService {
  const store = new Map<string, UserProfile>();

  return {
    async getProfile(user) {
      let profile = store.get(user.id);
      if (!profile) {
        profile = seedProfile(user);
        store.set(user.id, profile);
      }
      return { ...profile };
    },

    async updateProfile(userId, input) {
      const current = store.get(userId);
      if (!current) throw new Error('Không tìm thấy hồ sơ.');
      let avatarUrl = current.avatarUrl;
      if (input.removeAvatar) avatarUrl = null;
      if (input.avatarFile && typeof URL.createObjectURL === 'function')
        avatarUrl = URL.createObjectURL(input.avatarFile);
      // Thu hồi blob cũ khi ảnh bị thay hoặc gỡ.
      if (
        current.avatarUrl?.startsWith('blob:') &&
        avatarUrl !== current.avatarUrl
      )
        URL.revokeObjectURL(current.avatarUrl);
      const next: UserProfile = {
        ...current,
        dateOfBirth: input.dateOfBirth || null,
        phone: normalizePhone(input.phone),
        secondaryEmail: input.secondaryEmail.trim().toLowerCase(),
        avatarUrl,
      };
      store.set(userId, next);
      return { ...next };
    },
  };
}

export const profileService: ProfileService = createProfileService();
