import { apiRequest } from '@/api/request';
import type { ProfileInput, UserProfile } from '@/types/profile';

// Hợp đồng chung của Hồ sơ cá nhân. Mọi endpoint chỉ thao tác trên tài khoản
// đang đăng nhập, backend lấy id từ phiên.
export interface ProfileService {
  getProfile(): Promise<UserProfile>;
  updateProfile(input: ProfileInput): Promise<UserProfile>;
  uploadAvatar(file: File): Promise<UserProfile>;
  removeAvatar(): Promise<UserProfile>;
}

// Hình dạng ProfileDto của backend; trường trống trả null.
interface ProfileDto {
  fullName: string;
  dateOfBirth: string | null;
  phone: string | null;
  secondaryEmail: string | null;
  avatarUrl: string | null;
  className: string | null;
  department: string | null;
  academicTitle: string | null;
  lastLogins: string[];
}

const toProfile = (dto: ProfileDto): UserProfile => ({
  fullName: dto.fullName,
  dateOfBirth: dto.dateOfBirth,
  phone: dto.phone ?? '',
  secondaryEmail: dto.secondaryEmail ?? '',
  avatarUrl: dto.avatarUrl,
  className: dto.className,
  department: dto.department,
  academicTitle: dto.academicTitle,
  lastLogins: dto.lastLogins,
});

export const profileService: ProfileService = {
  async getProfile() {
    return toProfile(await apiRequest<ProfileDto>('/profile'));
  },

  async updateProfile(input) {
    return toProfile(
      await apiRequest<ProfileDto>('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: input.fullName,
          dateOfBirth: input.dateOfBirth || null,
          phone: input.phone,
          secondaryEmail: input.secondaryEmail,
        }),
      }),
    );
  },

  async uploadAvatar(file) {
    const body = new FormData();
    body.append('file', file);
    return toProfile(
      await apiRequest<ProfileDto>('/profile/avatar', { method: 'PUT', body }),
    );
  },

  async removeAvatar() {
    return toProfile(
      await apiRequest<ProfileDto>('/profile/avatar', { method: 'DELETE' }),
    );
  },
};
