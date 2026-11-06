// Hồ sơ cá nhân, hợp đồng GET/PUT /api/profile.
export interface UserProfile {
  fullName: string;
  // yyyy-MM-dd hoặc null.
  dateOfBirth: string | null;
  phone: string;
  secondaryEmail: string;
  avatarUrl: string | null;
  // Chỉ xem, do Giáo vụ quản lý.
  className: string | null;
  department: string | null;
  academicTitle: string | null;
  // ISO 8601, mới nhất trước.
  lastLogins: string[];
}

export interface ProfileInput {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  secondaryEmail: string;
  // Ảnh mới chọn; null = giữ nguyên (hoặc gỡ nếu removeAvatar).
  avatarFile: File | null;
  removeAvatar: boolean;
}
