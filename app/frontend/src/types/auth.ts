export type UserRole = 'Student' | 'Lecturer' | 'AcademicAffairs';

export interface CurrentUser {
  id: string;
  userCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  // Đường dẫn cùng origin tới ảnh của chính người dùng; null khi chưa có ảnh.
  avatarUrl?: string | null;
}

export interface ActivationCodeSent {
  expiresAt: string;
  resendAvailableAt: string;
}
