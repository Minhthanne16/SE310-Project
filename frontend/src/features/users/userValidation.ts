import type { UserInput } from '@/types/user';

export type UserField = Exclude<keyof UserInput, 'role'>;
export type UserFieldErrors = Partial<Record<UserField, string>>;

const CODE_PATTERN = /^[A-Za-z0-9._-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!input.userCode) errors.userCode = 'Nhập mã người dùng.';
  else if (input.userCode.length > 50) errors.userCode = 'Tối đa 50 ký tự.';
  else if (!CODE_PATTERN.test(input.userCode))
    errors.userCode = 'Chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới.';

  if (!input.fullName) errors.fullName = 'Nhập họ tên.';
  else if (input.fullName.length > 200) errors.fullName = 'Tối đa 200 ký tự.';

  if (!input.email) errors.email = 'Nhập email.';
  else if (input.email.length > 256) errors.email = 'Tối đa 256 ký tự.';
  else if (!EMAIL_PATTERN.test(input.email))
    errors.email = 'Email không hợp lệ.';

  if (input.role === 'Student' && !input.className)
    errors.className = 'Nhập lớp của sinh viên.';
  if (input.role === 'Lecturer' && !input.department)
    errors.department = 'Nhập bộ môn của giảng viên.';

  for (const field of ['className', 'department', 'academicTitle'] as const) {
    if (!errors[field] && input[field].length > 100)
      errors[field] = 'Tối đa 100 ký tự.';
  }
  return errors;
}
