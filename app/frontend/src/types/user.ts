import type { UserRole } from '@/types/auth';

// Người dùng trong màn Quản lý người dùng của Giáo vụ. Backend chưa có
// enum trạng thái: trạng thái suy ra từ isActive + mustChangePassword.
export interface ManagedUser {
  id: string;
  userCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  // yyyy-MM-dd hoặc null.
  dateOfBirth: string | null;
  className: string | null;
  department: string | null;
  academicTitle: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  // Đã phát sinh dữ liệu (đề tài, điểm...): chỉ được vô hiệu hóa, không xóa.
  hasData: boolean;
}

export type UserStatus = 'active' | 'pending' | 'disabled';

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  active: 'Đang hoạt động',
  pending: 'Chưa đăng nhập',
  disabled: 'Đã vô hiệu hóa',
};

export function getUserStatus(user: ManagedUser): UserStatus {
  if (!user.isActive) return 'disabled';
  return user.mustChangePassword ? 'pending' : 'active';
}

// Dữ liệu form thêm/sửa; chuỗi rỗng nghĩa là không nhập.
export interface UserInput {
  userCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  dateOfBirth: string;
  className: string;
  department: string;
  academicTitle: string;
  // Chỉ dùng khi tạo giảng viên/giáo vụ (PDR-055); sinh viên để trống.
  password: string;
}

// Khớp UserImportReportDto / UserImportRowDto của backend (PDR-004).
export interface UserImportRow {
  rowNumber: number;
  userCode: string;
  fullName: string;
  email: string;
  role: string;
  dateOfBirth: string | null;
  className: string | null;
  department: string | null;
  academicTitle: string | null;
  errors: string[];
}

export interface UserImportReport {
  totalRows: number;
  validRows: number;
  errorRows: number;
  importedRows: number;
  rows: UserImportRow[];
}

// Một mục lịch sử thao tác trên tài khoản (GET /api/users/{id}/audit).
export interface UserAuditEntry {
  id: string;
  // Created | Updated | Disabled | Reactivated | PasswordReset | PasswordChanged
  // | PasswordResetByLink | Deleted; giá trị lạ vẫn hiển thị nguyên tên.
  action: string;
  actorUserId: string;
  // null khi tài khoản thực hiện đã bị xóa.
  actorName: string | null;
  // Ví dụ { fullName: { from, to } }, { role, source: 'csv' }, { mode: 'userCode' }.
  details: Record<string, unknown> | null;
  createdAt: string;
}
