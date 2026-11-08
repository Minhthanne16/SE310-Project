import type { UserAuditEntry } from '@/types/user';

const FIELD_LABEL: Record<string, string> = {
  fullName: 'Họ tên',
  email: 'Email',
  dateOfBirth: 'Ngày sinh',
  className: 'Lớp sinh hoạt',
  department: 'Bộ môn',
  academicTitle: 'Học hàm, học vị',
  phone: 'Số điện thoại',
  secondaryEmail: 'Email phụ',
};

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export interface AuditDescription {
  title: string;
  // Từng trường đổi ở dạng "Họ tên: A → B".
  changes: string[];
}

const show = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '(trống)'
    : String(value);

function describeUpdate(details: Record<string, unknown>): AuditDescription {
  if (details.avatar === 'uploaded')
    return { title: 'Cập nhật ảnh đại diện', changes: [] };
  if (details.avatar === 'removed')
    return { title: 'Gỡ ảnh đại diện', changes: [] };
  const changes = Object.entries(details).map(([field, change]) => {
    const { from, to } = (change ?? {}) as { from?: unknown; to?: unknown };
    return `${FIELD_LABEL[field] ?? field}: ${show(from)} → ${show(to)}`;
  });
  return { title: 'Sửa thông tin', changes };
}

// Diễn giải một mục lịch sử cho người đọc; không bao giờ có mật khẩu trong details.
export function describeAuditEntry(entry: UserAuditEntry): AuditDescription {
  const details = entry.details ?? {};
  switch (entry.action) {
    case 'Created':
      return {
        title:
          details.source === 'csv'
            ? 'Tạo tài khoản bằng nhập CSV'
            : 'Tạo tài khoản',
        changes: [],
      };
    case 'Updated':
      return describeUpdate(details);
    case 'Disabled':
      return {
        title:
          details.reason === 'hasData'
            ? 'Vô hiệu hóa thay cho xóa vì tài khoản đã có dữ liệu'
            : 'Vô hiệu hóa tài khoản',
        changes: [],
      };
    case 'Reactivated':
      return { title: 'Kích hoạt lại tài khoản', changes: [] };
    case 'PasswordReset':
      return {
        title:
          details.mode === 'custom'
            ? 'Đặt lại mật khẩu (Giáo vụ đặt mật khẩu mới)'
            : 'Đặt lại mật khẩu về mã người dùng',
        changes: [],
      };
    case 'PasswordChanged':
      return { title: 'Tự đổi mật khẩu', changes: [] };
    case 'PasswordResetByLink':
      return {
        title: 'Tự đặt lại mật khẩu qua liên kết email',
        changes: [],
      };
    case 'Deleted':
      return { title: 'Xóa tài khoản', changes: [] };
    default:
      return { title: entry.action, changes: [] };
  }
}

// Người thực hiện: chính chủ, người khác theo tên, hoặc tài khoản đã bị xóa.
export function describeAuditActor(
  entry: UserAuditEntry,
  targetUserId: string,
): string {
  if (entry.actorUserId === targetUserId) return 'Chính chủ tài khoản';
  if (entry.actorName) return entry.actorName;
  return entry.actorUserId === EMPTY_GUID ? 'Hệ thống' : 'Tài khoản đã xóa';
}
