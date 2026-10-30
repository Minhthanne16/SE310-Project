import { EMAIL_PATTERN } from '@/lib/validation';
import type { UserRole } from '@/types/auth';
import type { ManagedUser, UserInput } from '@/types/user';

export type UserField = Exclude<keyof UserInput, 'role'>;
export type UserFieldErrors = Partial<Record<UserField, string>>;

const CODE_PATTERN = /^[A-Za-z0-9._-]+$/;

// Tên mã người dùng theo vai trò, dùng trong thông báo lỗi.
export const USER_CODE_NAME: Record<UserRole, string> = {
  Student: 'MSSV',
  Lecturer: 'Mã giảng viên',
  AcademicAffairs: 'Mã giáo vụ',
};

// Chuẩn hóa trước khi kiểm tra/gửi: cắt khoảng trắng, email viết thường.
export function normalizeUserInput(input: UserInput): UserInput {
  return {
    ...input,
    userCode: input.userCode.trim(),
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    className: input.className.trim(),
    department: input.department.trim(),
    academicTitle: input.academicTitle.trim(),
  };
}

// Phản chiếu quy tắc CSV phía backend (UserImport.cs, PDR-004): mã ≤ 50 ký tự
// gồm chữ/số/./-/_, họ tên ≤ 200, email hợp lệ ≤ 256, lớp bắt buộc với sinh
// viên, bộ môn bắt buộc với giảng viên, lớp/bộ môn/học hàm ≤ 100.
export function validateUserInput(raw: UserInput): UserFieldErrors {
  const input = normalizeUserInput(raw);
  const errors: UserFieldErrors = {};

  if (!input.userCode)
    errors.userCode =
      input.role === 'Student'
        ? 'Nhập MSSV.'
        : `Nhập ${USER_CODE_NAME[input.role].toLowerCase()}.`;
  else if (input.userCode.length > 50) errors.userCode = 'Tối đa 50 ký tự.';
  else if (!CODE_PATTERN.test(input.userCode))
    errors.userCode = 'Chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới.';

  if (!input.fullName) errors.fullName = 'Nhập họ và tên.';
  else if (input.fullName.length > 200) errors.fullName = 'Tối đa 200 ký tự.';

  if (!input.email) errors.email = 'Nhập email.';
  else if (input.email.length > 256) errors.email = 'Tối đa 256 ký tự.';
  else if (!EMAIL_PATTERN.test(input.email))
    errors.email = 'Email chưa đúng định dạng, ví dụ ten@truong.edu.vn.';

  if (input.role === 'Student' && !input.className)
    errors.className = 'Nhập lớp sinh hoạt.';
  if (input.role === 'Lecturer' && !input.department)
    errors.department = 'Nhập bộ môn.';

  // Chỉ kiểm tra trường thuộc vai trò hiện tại; trường ẩn không chặn lưu.
  const roleFields: Array<'className' | 'department' | 'academicTitle'> =
    input.role === 'Student'
      ? ['className']
      : input.role === 'Lecturer'
        ? ['department', 'academicTitle']
        : [];
  for (const field of roleFields) {
    if (!errors[field] && input[field].length > 100)
      errors[field] = 'Tối đa 100 ký tự.';
  }
  return errors;
}

// Báo trùng mã/email với người dùng đang có (danh sách đã tải), nêu rõ tài
// khoản đang giữ mã/email. Mã so khớp chính xác như chỉ mục của backend; email
// không phân biệt hoa thường. Backend vẫn là nơi kiểm tra cuối cùng.
export function findDuplicateErrors(
  raw: UserInput,
  others: ManagedUser[],
  options: { checkCode: boolean } = { checkCode: true },
): UserFieldErrors {
  const input = normalizeUserInput(raw);
  const errors: UserFieldErrors = {};
  if (options.checkCode && input.userCode) {
    const owner = others.find((u) => u.userCode === input.userCode);
    if (owner)
      errors.userCode = `${USER_CODE_NAME[input.role]} ${input.userCode} đã được dùng cho tài khoản ${owner.fullName}. Nhập mã khác, hoặc tìm tài khoản đó để sửa.`;
  }
  if (input.email) {
    const owner = others.find((u) => u.email.toLowerCase() === input.email);
    if (owner)
      errors.email = `Email này đã được dùng cho tài khoản ${owner.userCode} · ${owner.fullName}. Mỗi người dùng cần một email riêng.`;
  }
  return errors;
}
