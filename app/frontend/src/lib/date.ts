// Ngày dạng yyyy-MM-dd (hoặc ISO có giờ) → dd/MM/yyyy cho ô hiển thị; chưa có
// thì "—". Chuỗi không đúng dạng được trả nguyên để không giấu dữ liệu lạ.
// Mốc của đợt dùng formatDate ở features/rounds/roundUtils.ts ("Chưa đặt").
export function formatDateOrDash(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Ô nhập ngày hiển thị dd/MM/yyyy nhưng dữ liệu (state, API) vẫn là yyyy-MM-dd.
// Các hàm dưới đây chuyển qua lại giữa hai dạng cho DateInput.

// yyyy-MM-dd (hoặc ISO có giờ) → dd/MM/yyyy; không nhận ra thì trả chuỗi rỗng.
export function isoToDisplayDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// dd/MM/yyyy → yyyy-MM-dd khi là một ngày có thật; còn lại trả chuỗi rỗng.
export function displayDateToIso(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return '';
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const valid =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d);
  return valid ? `${y}-${mo}-${d}` : '';
}

// Chuẩn hóa chữ người dùng gõ/dán vào ô ngày về dạng dd/MM/yyyy (có thể dở dang).
// Chỉ giữ chữ số và tự chèn dấu "/" giữa các nhóm, không chèn dấu ở cuối để
// xóa lùi không bị kẹt. Dán yyyy-MM-dd hoặc d/M/yyyy cũng được đổi đúng dạng.
export function maskDateTyping(raw: string): string {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const loose = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (loose) {
    return `${loose[1].padStart(2, '0')}/${loose[2].padStart(2, '0')}/${loose[3]}`;
  }
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)];
  return parts.filter(Boolean).join('/');
}
