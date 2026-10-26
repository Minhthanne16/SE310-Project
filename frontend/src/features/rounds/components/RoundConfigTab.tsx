'use client';

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle } from 'lucide-react';
import { validateMilestones } from '@/features/rounds/roundUtils';
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
}

const sameConfig = (a: Milestone[], b: Milestone[]) =>
  JSON.stringify(a) === JSON.stringify(b);

// Tab Cấu hình: 9 mốc, ngày bắt đầu/kết thúc, "Thông báo cho", công tắc "Cho
// nộp trễ" (chỉ Đề cương, Giữa kỳ, Cuối kỳ). Kiểm tra thứ tự mốc ngay khi gõ.
export const RoundConfigTab: React.FC<RoundConfigTabProps> = ({
  round,
  roundService,
  onSaved,
}) => {
  const readOnly = round.status === 'Đã kết thúc';
  const [draft, setDraft] = useState<Milestone[]>(round.milestones);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const errors = useMemo(() => validateMilestones(draft), [draft]);
  const invalid = Object.keys(errors).length > 0;
  const dirty = !sameConfig(draft, round.milestones);

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
      toast.success('Đã lưu cấu hình.');
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
    <section className="app-card" aria-labelledby="round-config-title">
      <div className="app-card-header">
        <h2 id="round-config-title">Cấu hình 9 mốc</h2>
      </div>
      {readOnly && (
        <p className="login-note">Đợt đã kết thúc nên cấu hình chỉ để xem.</p>
      )}
      {(invalid || saveError) && (
        <div role="alert" className="login-error">
          <AlertCircle size={18} />
          <span>
            {saveError ??
              'Có mốc sai thứ tự hoặc thiếu ngày. Sửa các dòng báo lỗi trước khi lưu.'}
          </span>
        </div>
      )}
      <div className="app-table-scroll">
        <table className="app-table app-config-table">
          <thead>
            <tr>
              <th scope="col">Mốc</th>
              <th scope="col">Bắt đầu</th>
              <th scope="col">Kết thúc</th>
              <th scope="col">Thông báo cho</th>
              <th scope="col">Cho nộp trễ</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((m) => {
              const error = errors[m.key];
              const errorId = `milestone-${m.key}-error`;
              const invalidProps = error
                ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
                : {};
              return (
                <tr key={m.key}>
                  <th scope="row" className="app-config-name">
                    {m.name}
                    {m.key === 'grading' && (
                      <span className="app-config-hint">
                        Chỉ để nhắc, không khóa phiếu chấm.
                      </span>
                    )}
                    {error && (
                      <p id={errorId} className="login-field-error">
                        {error}
                      </p>
                    )}
                  </th>
                  <td>
                    <input
                      type="date"
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
                    <select
                      className="app-select"
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
                          {a}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {m.allowLate === null ? (
                      <span className="app-muted" aria-label="Không áp dụng">
                        —
                      </span>
                    ) : (
                      <label className="app-switch">
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
                        <span>{m.allowLate ? 'Bật' : 'Tắt'}</span>
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="login-hint">
        “Cho nộp trễ” chỉ là công tắc bật hoặc tắt; thời hạn nộp trễ chưa được
        quy định.
      </p>
      {!readOnly && (
        <div className="dialog-actions">
          <button
            type="button"
            className="app-button"
            disabled={!dirty || saving}
            onClick={() => {
              setDraft(round.milestones);
              setSaveError(null);
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            className="app-button app-button-primary"
            disabled={!dirty || invalid || saving}
            aria-busy={saving}
            onClick={() => void save()}
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      )}
    </section>
  );
};
