// Hồ sơ cá nhân. Backend chưa có API hồ sơ; các trường này khớp thực thể User
// (ngày sinh, lớp, bộ môn, học hàm, lần đăng nhập cuối) cộng các trường người
// dùng tự sửa mà thiết kế yêu cầu (SĐT, email phụ, ảnh đại diện).
export interface UserProfile {
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
  dateOfBirth: string;
  phone: string;
  secondaryEmail: string;
  // Ảnh mới chọn; null = giữ nguyên (hoặc gỡ nếu removeAvatar).
  avatarFile: File | null;
  removeAvatar: boolean;
}
