// Chặn CSV formula injection (PDR-004): ô bắt đầu bằng = + - @ hoặc tab/CR
// bị Excel/Sheets hiểu là công thức, nên thêm dấu ' phía trước.
export function neutralizeFormula(value: string | null | undefined): string {
  const text = value ?? '';
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function escapeCsvCell(value: string | null | undefined): string {
  const text = neutralizeFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(header: string[], rows: string[][]): string {
  return (
    [header, ...rows]
      .map((line) => line.map(escapeCsvCell).join(','))
      .join('\r\n') + '\r\n'
  );
}

// Tải CSV về máy. BOM giúp Excel đọc đúng tiếng Việt UTF-8.
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
