// Chữ cái đầu của họ và tên, dùng cho avatar mặc định.
export const initials = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  const first = parts.length > 1 ? parts[0] : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
};
