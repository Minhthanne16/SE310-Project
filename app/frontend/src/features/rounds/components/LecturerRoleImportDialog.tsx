'use client';

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Upload } from 'lucide-react';
import '@/features/rounds/rounds.css';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import { downloadXlsx } from '@/lib/xlsx';
import type { RoundService } from '@/features/rounds/services/roundService';
import type {
  LecturerRoleImportRow,
  LecturerRolesPreviewResult,
  Round,
} from '@/types/round';

interface LecturerRoleImportDialogProps {
  round: Round;
  roundService: RoundService;
  onClose: () => void;
  onImported: (round: Round) => void;
}

const isTruthy = (v: unknown): boolean =>
  Boolean(v && /^(x|1|true|yes|c[oó])$/i.test(String(v).trim()));

export const LecturerRoleImportDialog: React.FC<
  LecturerRoleImportDialogProps
> = ({ round, roundService, onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<LecturerRoleImportRow[] | null>(null);
  const [preview, setPreview] = useState<LecturerRolesPreviewResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await downloadXlsx('Mau_nhap_vai_tro_giang_vien.xlsx', {
        sheetName: 'Vai trò giảng viên',
        header: [
          'Mã giảng viên / Email',
          'Hướng dẫn',
          'Phản biện',
          'Hội đồng',
        ],
        rows: [
          ['CB101', 'x', '', 'x'],
          ['CB102', '1', '1', ''],
          ['gv.mau@university.edu.vn', 'true', 'true', 'true'],
        ],
      });
      toast.success('Đã tải tệp Excel mẫu.');
    } catch {
      toast.error('Không tải được tệp mẫu.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setPreview(null);
    setLoading(true);

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await selected.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error('Tệp Excel không có trang tính nào.');
      }

      const parsedRows: LecturerRoleImportRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Bỏ qua tiêu đề
        const code = String(row.getCell(1).value ?? '').trim();
        if (!code) return;
        parsedRows.push({
          code,
          isSupervisor: isTruthy(row.getCell(2).value),
          isReviewer: isTruthy(row.getCell(3).value),
          isCommittee: isTruthy(row.getCell(4).value),
        });
      });

      if (parsedRows.length === 0) {
        throw new Error('Không tìm thấy dữ liệu giảng viên trong tệp.');
      }

      setRows(parsedRows);
      const res = await roundService.previewLecturerRoles(round.id, parsedRows);
      setPreview(res);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không đọc được tệp Excel. Vui lòng kiểm tra định dạng.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!rows || !preview || preview.valid.length === 0 || importing) return;
    setImporting(true);
    setError(null);
    try {
      const updated = await roundService.importLecturerRoles(round.id, rows);
      toast.success(
        `Đã nhập thành công ${preview.valid.length} giảng viên.`,
      );
      onImported(updated);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nhập vai trò thất bại. Thử lại sau.',
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <RoundModal
      titleId="lecturer-roles-import-title"
      size="lg"
      onClose={onClose}
    >
      <div className="rnd-dialog-flow">
        <h2 id="lecturer-roles-import-title" className="rnd-modal-title">
          Nhập vai trò giảng viên từ Excel
        </h2>
        <p className="rnd-modal-desc">
          Tải tệp Excel danh sách giảng viên để cập nhật hoặc thêm vai trò
          (Hướng dẫn, Phản biện, Hội đồng) trong đợt. Cột vai trò điền{' '}
          <code>x</code>, <code>1</code> hoặc <code>true</code>.
        </p>

        <div className="rnd-file-bar">
          <button
            type="button"
            className="rnd-btn"
            onClick={handleDownloadTemplate}
          >
            <Download size={16} aria-hidden="true" />
            Tải tệp mẫu (.xlsx)
          </button>
          <label className="rnd-btn rnd-btn-primary">
            <Upload size={16} aria-hidden="true" />
            {file ? 'Đổi tệp khác' : 'Chọn tệp Excel'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="app-visually-hidden"
              onChange={handleFileChange}
            />
          </label>
          {file && <span className="rnd-file-name">{file.name}</span>}
        </div>

        {loading && (
          <p className="rnd-loading-state" aria-busy="true">
            Đang phân tích tệp Excel...
          </p>
        )}

        {error && (
          <p className="rnd-field-err" role="alert">
            {error}
          </p>
        )}

        {preview && (
          <div className="rnd-preview-summary">
            <div className="rnd-stats-bar">
              <span className="rnd-pill rnd-pill-ok">
                Hợp lệ: {preview.valid.length}
              </span>
              {preview.errors.length > 0 && (
                <span className="rnd-pill rnd-pill-bad">
                  Lỗi: {preview.errors.length}
                </span>
              )}
            </div>

            {preview.errors.length > 0 && (
              <div className="rnd-preview-errors" role="alert">
                <h3>Các dòng có lỗi (sẽ bị bỏ qua):</h3>
                <ul>
                  {preview.errors.map((err, idx) => (
                    <li key={idx}>
                      <b>{err.code}</b>: {err.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.valid.length > 0 && (
              <div className="rnd-preview-table-box">
                <table className="rnd-table">
                  <thead>
                    <tr>
                      <th scope="col">Giảng viên</th>
                      <th scope="col">Bộ môn</th>
                      <th scope="col">Hướng dẫn</th>
                      <th scope="col">Phản biện</th>
                      <th scope="col">Hội đồng</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.map((item) => (
                      <tr key={item.code}>
                        <td>
                          <b>{item.name}</b>
                          <div className="rnd-meta">
                            {item.code} · {item.email}
                          </div>
                        </td>
                        <td>{item.unit}</td>
                        <td>{item.isSupervisor ? '✓' : '—'}</td>
                        <td>{item.isReviewer ? '✓' : '—'}</td>
                        <td>{item.isCommittee ? '✓' : '—'}</td>
                        <td>
                          <span
                            className={`rnd-pill ${
                              item.isNew ? 'rnd-pill-purple' : 'rnd-pill-neutral'
                            }`}
                          >
                            {item.isNew ? 'Thêm mới vào đợt' : 'Cập nhật'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="rnd-modal-actions">
          <button
            type="button"
            className="rnd-btn"
            disabled={importing}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="rnd-btn rnd-btn-primary"
            disabled={
              !preview || preview.valid.length === 0 || importing || loading
            }
            aria-busy={importing}
            onClick={handleConfirmImport}
          >
            {importing
              ? 'Đang nhập...'
              : `Xác nhận nhập (${preview?.valid.length ?? 0} GV)`}
          </button>
        </div>
      </div>
    </RoundModal>
  );
};
