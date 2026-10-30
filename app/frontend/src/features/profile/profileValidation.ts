import { EMAIL_PATTERN } from '@/lib/validation';
import type { ProfileInput } from '@/types/profile';

export type ProfileField = 'dateOfBirth' | 'phone' | 'secondaryEmail';
export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

// Giới hạn ảnh tạm thời, chờ OQ-006 (dung lượng, định dạng tệp) được chốt.
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const normalizePhone = (phone: string): string =>
  phone.replace(/[\s.]/g, '');

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type))
    return `Ảnh "${file.name}" không đúng định dạng. Chỉ nhận JPG, PNG hoặc WebP.`;
  if (file.size > AVATAR_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace('.', ',');
    return `Ảnh "${file.name}" nặng ${mb} MB, vượt quá 2 MB. Chọn ảnh nhỏ hơn hoặc giảm kích thước ảnh rồi thử lại.`;
  }
  return null;
}

export const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// accountEmail là email đăng nhập (chỉ xem); email phụ phải khác email này.
export function validateProfileInput(
  input: ProfileInput,
  accountEmail: string,
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  if (input.dateOfBirth && input.dateOfBirth > todayIso())
    errors.dateOfBirth = 'Ngày sinh không được ở tương lai.';

  const phone = normalizePhone(input.phone);
  if (phone && !/^0\d{9}$/.test(phone))
    errors.phone =
      'Số điện thoại không đúng định dạng. Nhập 10 chữ số, bắt đầu bằng 0, ví dụ 0912345678.';

  const email = input.secondaryEmail.trim().toLowerCase();
  if (email) {
    if (email.length > 256 || !EMAIL_PATTERN.test(email))
      errors.secondaryEmail =
        'Email phụ không đúng định dạng. Ví dụ: ten@gmail.com.';
    else if (email === accountEmail.toLowerCase())
      errors.secondaryEmail = 'Email phụ phải khác email tài khoản.';
  }
  return errors;
}
