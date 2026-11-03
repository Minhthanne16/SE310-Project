'use client';

import React, { useRef, useState } from 'react';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import type { TopicExportKind } from '@/features/topics/topicExport';

interface ExportTopicsDialogProps {
  roundName: string;
  // Số đề tài theo bộ lọc hiện tại của bảng.
  filteredCount: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (kind: TopicExportKind) => void;
}

const KINDS: { kind: TopicExportKind; title: string; columns: string }[] = [
  {
    kind: 'topics',
    title: 'Danh sách đề tài',
    columns:
      'Mã, tên đề tài, lĩnh vực, GV hướng dẫn, nhóm, nguồn (GV công bố / SV đề xuất), trạng thái, tiến độ khóa luận.',
  },
  {
    kind: 'registrations',
    title: 'Danh sách đăng ký',
    columns:
      'MSSV, họ tên, lớp, mã và tên đề tài, GV hướng dẫn, trạng thái đăng ký (Đã đăng ký, Chờ GV duyệt, Bị từ chối, Chưa có đề tài).',
  },
];

// Hộp "Xuất danh sách ra Excel": chọn một trong hai danh sách, tải tệp .xlsx.
export const ExportTopicsDialog: React.FC<ExportTopicsDialogProps> = ({
  roundName,
  filteredCount,
  busy,
  error,
  onCancel,
  onConfirm,
}) => {
  const [kind, setKind] = useState<TopicExportKind>('topics');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const empty = kind === 'topics' && filteredCount === 0;

  return (
    <RoundModal
      titleId="export-topics-title"
      size="md"
      busy={busy}
      onClose={onCancel}
      initialFocusRef={cancelRef}
    >
      <h2 id="export-topics-title">Xuất danh sách ra Excel</h2>
      <p className="rnd-modal-text">
        Tệp .xlsx của đợt {roundName}. Danh sách đề tài theo bộ lọc đang chọn ở
        bảng ({filteredCount} đề tài); danh sách đăng ký gồm mọi sinh viên của
        đợt. Mỗi dòng đều có cột trạng thái.
      </p>
      <fieldset className="rnd-choice-list">
        <legend className="app-visually-hidden">Loại danh sách</legend>
        {KINDS.map((k) => (
          <label key={k.kind} className="rnd-choice">
            <input
              type="radio"
              name="export-kind"
              checked={kind === k.kind}
              onChange={() => setKind(k.kind)}
            />
            <span>
              <b>{k.title}</b>
              <span>{k.columns}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {empty && (
        <p role="alert" className="rnd-note rnd-note-warn">
          Danh sách đang trống theo bộ lọc hiện tại nên không có gì để xuất. Đổi
          hoặc xóa bộ lọc rồi thử lại.
        </p>
      )}
      {error && (
        <p role="alert" className="rnd-note rnd-note-bad">
          {error}
        </p>
      )}
      <div className="rnd-modal-actions">
        <button
          ref={cancelRef}
          type="button"
          className="rnd-btn"
          onClick={onCancel}
          disabled={busy}
        >
          Hủy
        </button>
        <button
          type="button"
          className="rnd-btn rnd-btn-primary"
          onClick={() => onConfirm(kind)}
          disabled={busy || empty}
          aria-busy={busy}
        >
          {busy ? 'Đang tạo tệp...' : 'Tải tệp .xlsx'}
        </button>
      </div>
    </RoundModal>
  );
};
