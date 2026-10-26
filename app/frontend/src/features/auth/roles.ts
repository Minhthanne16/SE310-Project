import type { UserRole } from '@/types/auth';

// Trang chủ theo vai trò, theo docs/DESIGN/01-sitemap.md.
export const ROLE_HOME: Record<UserRole, string> = {
  Student: '/sv',
  Lecturer: '/gv',
  AcademicAffairs: '/giao-vu',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  Student: 'Sinh viên',
  Lecturer: 'Giảng viên',
  AcademicAffairs: 'Giáo vụ',
};
