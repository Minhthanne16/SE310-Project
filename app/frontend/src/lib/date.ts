// Ngày dạng yyyy-MM-dd (hoặc ISO có giờ) → dd/MM/yyyy cho ô hiển thị; chưa có
// thì "—". Chuỗi không đúng dạng được trả nguyên để không giấu dữ liệu lạ.
// Mốc của đợt dùng formatDate ở features/rounds/roundUtils.ts ("Chưa đặt").
export function formatDateOrDash(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
