'use client';

import React, { useRef, useState } from 'react';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import { nameKey, validateRoundInput } from '@/features/rounds/roundValidation';
import {
  DuplicateRoundNameError,
  RoundValidationError,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { ROUND_PROGRAMS, type Round, type RoundProgram } from '@/types/round';

interface CreateRoundDialogProps {
  roundService: RoundService;
  // Đợt hiện có, dùng cho ô "Sao chép cấu hình từ" và kiểm tra trùng tên.
  rounds: Round[];
  // Mở sẵn một đợt nguồn (nút "Sao chép từ đợt cũ").
  initialCopyFromId?: string;
  onClose: () => void;
  onCreated: (round: Round) => void;
}

const TOP_MISSING =
  'Chưa tạo được đợt. Vui lòng bổ sung các mục được đánh dấu bên dưới.';
const TOP_DUPLICATE = 'Chưa tạo được đợt. Tên đợt bị trùng với một đợt đã có.';

// Tạo đợt mới (artboard GiaoVu-DanhSachDot): chương trình + tên đợt, tùy chọn
// sao chép cấu hình từ đợt cũ. Tên đợt lưu dạng "Chương trình · Tên đợt" nên
// một tên chỉ trùng khi cùng chương trình. Lỗi hiện sau khi bấm Tạo đợt nháp.
export const CreateRoundDialog: React.FC<CreateRoundDialogProps> = ({
  roundService,
  rounds,
  initialCopyFromId = '',
  onClose,
  onCreated,
}) => {
  const [program, setProgram] = useState<RoundProgram>('Văn bằng 1');
  const [label, setLabel] = useState('');
  const [copyFromId, setCopyFromId] = useState(initialCopyFromId);
  const [nameError, setNameError] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const source = rounds.find((r) => r.id === copyFromId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    const composed = `${program} · ${label.trim().replace(/\s+/g, ' ')}`;
    const found = validateRoundInput({
      name: label,
      program,
      periodLabel: label,
    });
    if (found.name || found.periodLabel) {
      setNameError(found.name ?? found.periodLabel ?? 'Nhập tên đợt.');
      setTopError(TOP_MISSING);
      return;
    }
    const duplicate = rounds.find((r) => nameKey(r.name) === nameKey(composed));
    if (duplicate) {
      setNameError(
        `Chương trình ${program} đã có đợt “${duplicate.periodLabel}” (${duplicate.status}). Đặt tên khác để phân biệt.`,
      );
      setTopError(TOP_DUPLICATE);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setTopError(null);
    try {
      const created = await roundService.create({
        name: composed,
        program,
        periodLabel: label.trim(),
        copyFromId: copyFromId || undefined,
      });
      onCreated(created);
    } catch (err: unknown) {
      if (err instanceof DuplicateRoundNameError) {
        setNameError(err.message);
        setTopError(TOP_DUPLICATE);
      } else if (err instanceof RoundValidationError) {
        setNameError(err.fields.name ?? err.fields.periodLabel ?? null);
        setTopError(TOP_MISSING);
      } else {
        setTopError(
          err instanceof Error && err.message
            ? `Chưa tạo được đợt. ${err.message}`
            : 'Chưa tạo được đợt. Thử lại sau.',
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <RoundModal
      titleId="create-round-title"
      size="lg"
      busy={saving}
      onClose={onClose}
      initialFocusRef={nameRef}
    >
      <form
        onSubmit={submit}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 id="create-round-title">
            {source ? 'Tạo đợt từ đợt cũ' : 'Tạo đợt mới'}
          </h2>
          <span className="rnd-modal-sub">
            Đợt mới được tạo ở trạng thái Nháp, giảng viên và sinh viên chưa
            thấy cho đến khi bạn mở đợt.
          </span>
        </div>
        {topError && (
          <div role="alert" className="rnd-alert">
            {topError}
          </div>
        )}
        <div className="rnd-form-grid">
          <label className="rnd-label" htmlFor="round-program">
            Chương trình *
            <select
              id="round-program"
              className="rnd-select"
              value={program}
              onChange={(e) => {
                setProgram(e.target.value as RoundProgram);
                setNameError(null);
                setTopError(null);
              }}
            >
              {ROUND_PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div className="rnd-label">
            <label htmlFor="round-name">Tên đợt *</label>
            <input
              ref={nameRef}
              id="round-name"
              type="text"
              className="rnd-input"
              value={label}
              placeholder="Ví dụ: HK2 2026–2027"
              aria-required="true"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'round-name-error' : undefined}
              onChange={(e) => {
                setLabel(e.target.value);
                setNameError(null);
                setTopError(null);
              }}
            />
            {nameError && (
              <span id="round-name-error" className="rnd-field-err">
                {nameError}
              </span>
            )}
          </div>
          <label
            className="rnd-label"
            htmlFor="round-copy"
            style={{ gridColumn: '1 / -1' }}
          >
            Sao chép cấu hình từ
            <select
              id="round-copy"
              className="rnd-select"
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
            >
              <option value="">Không sao chép</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="rnd-note rnd-note-grey">
          {source
            ? `Sao chép từ ${source.name}: cấu hình mốc (Thông báo cho, Cho nộp trễ) và danh sách giảng viên. Không sao chép ngày và danh sách sinh viên; bạn đặt ngày ở tab Cấu hình và thêm sinh viên ở tab Sinh viên của đợt mới.`
            : 'Đợt trống: bạn nhập 9 mốc ở tab Cấu hình, rồi thêm giảng viên, sinh viên.'}
        </p>
        <div className="rnd-modal-actions">
          <button
            type="button"
            className="rnd-btn"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="rnd-btn rnd-btn-primary"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? 'Đang tạo...' : 'Tạo đợt nháp'}
          </button>
        </div>
      </form>
    </RoundModal>
  );
};
