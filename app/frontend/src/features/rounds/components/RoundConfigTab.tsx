'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import '@/features/rounds/rounds.css';
import { roundSpan, validateMilestones } from '@/features/rounds/roundUtils';
import {
  MilestoneOrderError,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  NOTIFY_AUDIENCES,
  type Milestone,
  type NotifyAudience,
  type Round,
} from '@/types/round';

interface RoundConfigTabProps {
  round: Round;
  roundService: RoundService;
  onSaved: (round: Round) => void;
  // Báo cho trang cha khi có thay đổi chưa lưu (để hỏi trước khi rời tab).
  onDirtyChange?: (dirty: boolean) => void;
}

const AUDIENCE_LABEL: Record<NotifyAudience, string> = {
  'Sinh viên': 'Sinh viên',
  'Giảng viên': 'Giảng viên',
  'Tất cả': 'Sinh viên và giảng viên',
};

const sameConfig = (a: Milestone[], b: Milestone[]) =>
  JSON.stringify(a) === JSON.stringify(b);

// Tab Cấu hình (artboard GiaoVu-DotKhoaLuan): thông tin đợt, 9 mốc với ngày bắt
// đầu/kết thúc, "Thông báo cho", công tắc "Cho nộp trễ" (chỉ Đề cương, Giữa
// kỳ, Cuối kỳ). Kiểm tra thứ tự mốc ngay khi gõ.
export const RoundConfigTab: React.FC<RoundConfigTabProps> = ({
  round,
  roundService,
  onSaved,
  onDirtyChange,
}) => {
  const readOnly = round.status === 'Đã kết thúc';
  const [draft, setDraft] = useState<Milestone[]>(round.milestones);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const errors = useMemo(() => validateMilestones(draft), [draft]);
  const errorCount = Object.keys(errors).length;
  const invalid = errorCount > 0;
  const dirty = !sameConfig(draft, round.milestones);
  // Chỉ báo động (role=alert) khi dòng đã đủ hai ngày mà sai; dòng mới nhập
  // một ngày chỉ hiện lỗi tại dòng.
  const hardInvalid = draft.some(
    (m) => errors[m.key] && m.startDate && m.endDate,
  );
  const weekOne = roundSpan(round.milestones)?.start ?? '';

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const patch = (key: Milestone['key'], change: Partial<Milestone>) => {
    setDraft((list) =>
      list.map((m) => (m.key === key ? { ...m, ...change } : m)),
    );
    setSaveError(null);
  };

  const save = async () => {
    if (saving || invalid || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await roundService.updateMilestones(round.id, draft);
      toast.success(
        round.status === 'Nháp'
          ? 'Đã lưu cấu hình. Đợt đang Nháp nên chưa gửi thông báo.'
          : 'Đã lưu cấu hình. Giảng viên và sinh viên trong đợt nhận thông báo về các mốc đã đổi.',
      );
      setDraft(updated.milestones);
      onSaved(updated);
    } catch (err: unknown) {
      setSaveError(
        err instanceof MilestoneOrderError
          ? 'Có mốc sai thứ tự. Sửa các dòng báo lỗi rồi lưu lại.'
          : err instanceof Error && err.message
            ? err.message
            : 'Lưu cấu hình thất bại. Thử lại sau.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rnd-panel">
      <section className="rnd-section" aria-labelledby="round-info-title">
        <h2 id="round-info-title">Thông tin đợt</h2>
        <div className="rnd-info-grid">
          <label className="rnd-label">
            Chương trình
            <input className="rnd-input" readOnly value={round.program} />
          </label>
          <label className="rnd-label">
            Tên đợt
            <input className="rnd-input" readOnly value={round.periodLabel} />
          </label>
          <label className="rnd-label">
            Ngày bắt đầu tuần 1
            <input
              type="date"
              className="rnd-input"
              readOnly
              value={weekOne}
            />
          </label>
        </div>
        <p className="rnd-hint">
          Ngày bắt đầu tuần 1 là thứ Hai của tuần chứa mốc sớm nhất; đổi bằng
          cách sửa ngày các mốc bên dưới.
        </p>
      </section>

      <section
        className="rnd-section rnd-section-flush"
        aria-labelledby="round-config-title"
      >
        <div className="rnd-section-head">
          <h2 id="round-config-title">Mốc thời gian</h2>
          <p>
            Bắt đầu và kết thúc của mỗi mục tạo thành một thanh trên biểu đồ
            tuần. Thông báo cho chỉ gửi đến giảng viên có vai trò ở mục đó
            (GVHD, GVPB, hội đồng). Với đề cương, giữa kỳ và cuối kỳ: bật Cho
            nộp trễ thì quá hạn sinh viên vẫn nộp được và bài nộp gắn nhãn Nộp
            trễ; tắt thì hết hạn là khóa nộp. Thời hạn nộp trễ chưa được quy
            định.
          </p>
        </div>
        <div className="rnd-table-scroll">
          <table className="rnd-table rnd-table-ms">
            <thead>
              <tr>
                <th scope="col">Mục</th>
                <th scope="col">Bắt đầu</th>
                <th scope="col">Kết thúc</th>
                <th scope="col">Nộp trễ</th>
                <th scope="col">Thông báo cho</th>
              </tr>
            </thead>
            <tbody>
              {draft.map((m) => {
                const error = errors[m.key];
                const errorId = `milestone-${m.key}-error`;
                const invalidProps = error
                  ? {
                      'aria-invalid': true as const,
                      'aria-describedby': errorId,
                    }
                  : {};
                return (
                  <tr key={m.key} className={error ? 'rnd-ms-row-bad' : ''}>
                    <th scope="row">
                      <span className="rnd-ms-name">
                        <span>{m.name}</span>
                        {m.key === 'grading' && (
                          <span className="rnd-ms-hint">
                            Chỉ để nhắc, không khóa phiếu chấm.
                          </span>
                        )}
                        {error && (
                          <span id={errorId} className="rnd-ms-err">
                            {error}
                          </span>
                        )}
                      </span>
                    </th>
                    <td>
                      <input
                        type="date"
                        className="rnd-date"
                        aria-label={`Bắt đầu ${m.name}`}
                        value={m.startDate}
                        disabled={readOnly}
                        onChange={(e) =>
                          patch(m.key, { startDate: e.target.value })
                        }
                        {...invalidProps}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="rnd-date"
                        aria-label={`Kết thúc ${m.name}`}
                        value={m.endDate}
                        disabled={readOnly}
                        onChange={(e) =>
                          patch(m.key, { endDate: e.target.value })
                        }
                        {...invalidProps}
                      />
                    </td>
                    <td>
                      {m.allowLate === null ? (
                        <>
                          <span className="rnd-na" aria-hidden="true">
                            —
                          </span>
                          <span className="app-visually-hidden">
                            Không áp dụng
                          </span>
                        </>
                      ) : (
                        <label className="rnd-late">
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label={`Cho nộp trễ ${m.name}`}
                            checked={m.allowLate}
                            disabled={readOnly}
                            onChange={(e) =>
                              patch(m.key, { allowLate: e.target.checked })
                            }
                          />
                          Cho nộp trễ
                        </label>
                      )}
                    </td>
                    <td>
                      <select
                        aria-label={`Thông báo cho ${m.name}`}
                        value={m.notifyAudience}
                        disabled={readOnly}
                        onChange={(e) =>
                          patch(m.key, {
                            notifyAudience: e.target.value as NotifyAudience,
                          })
                        }
                      >
                        {NOTIFY_AUDIENCES.map((a) => (
                          <option key={a} value={a}>
                            {AUDIENCE_LABEL[a]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          role={hardInvalid ? 'alert' : 'status'}
          className={`rnd-check-box ${invalid ? 'rnd-check-bad' : 'rnd-check-ok'}`}
          style={{ marginTop: 16 }}
        >
          <b>
            {invalid
              ? `${errorCount} mốc sai thứ tự. Sửa các dòng tô đỏ để lưu được.`
              : 'Các mốc đúng thứ tự.'}
          </b>
          <span>
            Thứ tự bắt buộc: mỗi mục kết thúc không trước ngày bắt đầu; các mục
            bắt đầu theo đúng thứ tự trong bảng (giảng viên gửi đề tài, công bố
            đề tài và đăng ký, đề cương, giữa kỳ, cuối kỳ, lịch phản biện, lịch
            bảo vệ, thời gian cho điểm, chốt bản cuối).
          </span>
        </div>
      </section>

      {!readOnly && (
        <section className="rnd-save-bar" aria-label="Lưu cấu hình">
          <span>
            {invalid && (
              <b id="save-why" className="rnd-save-why">
                Chưa lưu được: còn {errorCount} mốc sai thứ tự.
              </b>
            )}
            {saveError && (
              <b role="alert" className="rnd-save-why">
                {saveError}
              </b>
            )}
            Mẫu phiếu đánh giá cho hướng dẫn, phản biện và hội đồng được gán
            trong{' '}
            <Link className="rnd-link" href="/giao-vu/phieu-danh-gia">
              Phiếu đánh giá
            </Link>
            .
          </span>
          <span className="rnd-actions">
            <button
              type="button"
              className="rnd-btn"
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(round.milestones);
                setSaveError(null);
              }}
            >
              Hủy thay đổi
            </button>
            <button
              type="button"
              className="rnd-btn rnd-btn-primary"
              disabled={!dirty || invalid || saving}
              aria-busy={saving}
              aria-describedby={invalid ? 'save-why' : undefined}
              onClick={() => void save()}
            >
              {saving ? 'Đang lưu...' : 'Lưu và thông báo thay đổi'}
            </button>
          </span>
        </section>
      )}
    </div>
  );
};
