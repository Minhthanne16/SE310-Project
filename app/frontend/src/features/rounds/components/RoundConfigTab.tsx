'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import '@/features/rounds/rounds.css';
import { roundSpan, validateMilestones } from '@/features/rounds/roundUtils';
import {
  validateRoundInput,
  type RoundFieldErrors,
} from '@/features/rounds/roundValidation';
import {
  DuplicateRoundNameError,
  MilestoneOrderError,
  RoundValidationError,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  NOTIFY_AUDIENCES,
  ROUND_PROGRAMS,
  type Milestone,
  type NotifyAudience,
  type Round,
  type RoundProgram,
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

// Khớp RoundRules.MaxLecturerLoad ở backend.
const LOAD_LIMIT = 50;

// Số nguyên 0..50; 0 = chưa đặt mức nên chỉ so tối thiểu ≤ tối đa khi cả hai > 0.
function validateLoad(min: string, max: string): string | null {
  const valid = (v: string) =>
    /^\d+$/.test(v.trim()) && Number(v) <= LOAD_LIMIT;
  if (!valid(min) || !valid(max))
    return `Nhập số nguyên từ 0 đến ${LOAD_LIMIT}.`;
  if (Number(min) > 0 && Number(max) > 0 && Number(min) > Number(max))
    return 'Số đề tài tối thiểu không được lớn hơn tối đa.';
  return null;
}

// Tab Cấu hình (artboard GiaoVu-DotKhoaLuan): thông tin đợt, mức đề tài mỗi
// giảng viên, 9 mốc với ngày bắt
// đầu/kết thúc, "Thông báo cho", công tắc "Cho nộp trễ" (chỉ Đề cương, Giữa
// kỳ, Cuối kỳ). Kiểm tra thứ tự mốc ngay khi gõ.
export const RoundConfigTab: React.FC<RoundConfigTabProps> = ({
  round,
  roundService,
  onSaved,
  onDirtyChange,
}) => {
  const readOnly = round.status === 'Đã kết thúc';
  // Đợt đã mở (đang diễn ra hoặc đã kết thúc): thông tin đợt và mức đề tài không
  // sửa nữa, giáo vụ chỉ tiếp tục cập nhật các mốc thời gian.
  const infoLocked = round.status !== 'Nháp';
  const [draft, setDraft] = useState<Milestone[]>(round.milestones);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Thông tin đợt (chỉ sửa được khi Nháp): chương trình và tên đợt. Tên lưu
  // của đợt là "{chương trình} · {tên đợt}" như hộp Tạo đợt.
  const [program, setProgram] = useState<RoundProgram>(round.program);
  const [label, setLabel] = useState(round.periodLabel);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [serverFields, setServerFields] = useState<RoundFieldErrors>({});

  const cleanLabel = label.trim().replace(/\s+/g, ' ');
  const infoDirty =
    !infoLocked &&
    (program !== round.program || cleanLabel !== round.periodLabel);
  const infoFields = validateRoundInput({
    name: `${program} · ${cleanLabel}`,
    program,
    periodLabel: cleanLabel,
  });
  // Lỗi tên đợt hiện khi đang sửa; lỗi từ máy chủ (trùng tên) hiện đến khi sửa tiếp.
  const labelError = infoDirty
    ? (infoFields.periodLabel ?? serverFields.name ?? serverFields.periodLabel)
    : undefined;
  const infoInvalid = Object.keys(infoFields).length > 0;

  // Số đề tài mỗi GV (chỉ sửa khi Nháp). Giữ chuỗi để ô trống khi đang gõ.
  const [loadMin, setLoadMin] = useState(String(round.lecturerLoadMin));
  const [loadMax, setLoadMax] = useState(String(round.lecturerLoadMax));
  const [loadSaving, setLoadSaving] = useState(false);
  const [loadSaveError, setLoadSaveError] = useState<string | null>(null);
  const loadDirty =
    !infoLocked &&
    (loadMin !== String(round.lecturerLoadMin) ||
      loadMax !== String(round.lecturerLoadMax));
  const loadError = validateLoad(loadMin, loadMax);

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

  const anyDirty = dirty || infoDirty || loadDirty;
  useEffect(() => {
    onDirtyChange?.(anyDirty);
    return () => onDirtyChange?.(false);
  }, [anyDirty, onDirtyChange]);

  const saveInfo = async () => {
    if (infoSaving || infoInvalid || !infoDirty) return;
    setInfoSaving(true);
    setInfoError(null);
    setServerFields({});
    try {
      const updated = await roundService.update(round.id, {
        name: `${program} · ${cleanLabel}`,
        program,
        periodLabel: cleanLabel,
      });
      toast.success('Đã lưu thông tin đợt.');
      setProgram(updated.program);
      setLabel(updated.periodLabel);
      onSaved(updated);
    } catch (err: unknown) {
      if (err instanceof DuplicateRoundNameError)
        setServerFields({ periodLabel: err.message });
      else if (err instanceof RoundValidationError) setServerFields(err.fields);
      else
        setInfoError(
          err instanceof Error && err.message
            ? err.message
            : 'Lưu thông tin đợt thất bại. Thử lại sau.',
        );
    } finally {
      setInfoSaving(false);
    }
  };

  const saveLoad = async () => {
    if (loadSaving || loadError || !loadDirty) return;
    setLoadSaving(true);
    setLoadSaveError(null);
    try {
      const updated = await roundService.update(round.id, {
        name: round.name,
        program: round.program,
        periodLabel: round.periodLabel,
        lecturerLoadMin: Number(loadMin),
        lecturerLoadMax: Number(loadMax),
      });
      toast.success('Đã lưu số đề tài mỗi giảng viên.');
      setLoadMin(String(updated.lecturerLoadMin));
      setLoadMax(String(updated.lecturerLoadMax));
      onSaved(updated);
    } catch (err: unknown) {
      setLoadSaveError(
        err instanceof RoundValidationError
          ? Object.values(err.fields)[0] || err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Lưu số đề tài thất bại. Thử lại sau.',
      );
    } finally {
      setLoadSaving(false);
    }
  };

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
        {infoLocked && (
          <p className="rnd-note rnd-note-warn">
            Đợt đã mở nên không chỉnh sửa mục này nữa. Giáo vụ chỉ tiếp tục cập
            nhật các mốc thời gian.
          </p>
        )}
        <div className="rnd-info-grid">
          <label className="rnd-label">
            Chương trình
            <select
              className="rnd-select"
              disabled={infoLocked || infoSaving}
              value={infoLocked ? round.program : program}
              onChange={(e) => {
                setProgram(e.target.value as RoundProgram);
                setServerFields({});
                setInfoError(null);
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
            <label htmlFor="round-info-label">Tên đợt</label>
            <input
              id="round-info-label"
              type="text"
              className="rnd-input"
              disabled={infoLocked || infoSaving}
              value={infoLocked ? round.periodLabel : label}
              aria-invalid={labelError ? true : undefined}
              aria-describedby={
                labelError ? 'round-info-label-error' : undefined
              }
              onChange={(e) => {
                setLabel(e.target.value);
                setServerFields({});
                setInfoError(null);
              }}
            />
            {labelError && (
              <span id="round-info-label-error" className="rnd-field-err">
                {labelError}
              </span>
            )}
          </div>
          <label className="rnd-label">
            Ngày bắt đầu tuần 1
            <input type="date" className="rnd-input" readOnly value={weekOne} />
          </label>
        </div>
        <p className="rnd-hint">
          Ngày bắt đầu tuần 1 là thứ Hai của tuần chứa mốc sớm nhất; đổi bằng
          cách sửa ngày các mốc bên dưới.
        </p>
        {!infoLocked && (
          <div className="rnd-info-actions">
            {infoError && (
              <b role="alert" className="rnd-save-why">
                {infoError}
              </b>
            )}
            <button
              type="button"
              className="rnd-btn rnd-btn-primary"
              disabled={!infoDirty || infoInvalid || infoSaving}
              aria-busy={infoSaving}
              onClick={() => void saveInfo()}
            >
              {infoSaving ? 'Đang lưu...' : 'Lưu thông tin đợt'}
            </button>
          </div>
        )}
      </section>

      <section className="rnd-section" aria-labelledby="round-load-title">
        <h2 id="round-load-title">Số đề tài mỗi giảng viên nhận hướng dẫn</h2>
        {infoLocked && (
          <p className="rnd-note rnd-note-warn">
            Đợt đã mở nên không chỉnh sửa mục này nữa. Giáo vụ chỉ tiếp tục cập
            nhật các mốc thời gian.
          </p>
        )}
        <div className="rnd-info-grid">
          <label className="rnd-label">
            Tối thiểu
            <input
              type="number"
              className="rnd-input"
              min={0}
              max={LOAD_LIMIT}
              step={1}
              inputMode="numeric"
              readOnly={infoLocked}
              aria-invalid={loadError ? true : undefined}
              aria-describedby={loadError ? 'round-load-error' : undefined}
              value={loadMin}
              onChange={(e) => {
                setLoadMin(e.target.value);
                setLoadSaveError(null);
              }}
            />
          </label>
          <label className="rnd-label">
            Tối đa
            <input
              type="number"
              className="rnd-input"
              min={0}
              max={LOAD_LIMIT}
              step={1}
              inputMode="numeric"
              readOnly={infoLocked}
              aria-invalid={loadError ? true : undefined}
              aria-describedby={loadError ? 'round-load-error' : undefined}
              value={loadMax}
              onChange={(e) => {
                setLoadMax(e.target.value);
                setLoadSaveError(null);
              }}
            />
          </label>
        </div>
        <p className="rnd-hint">
          Tính cả đề tài giảng viên gửi và đề tài sinh viên đề xuất đã được
          giảng viên chấp nhận. Hai mức chỉ để cảnh báo: dưới tối thiểu khi hết
          hạn gửi đề tài, vượt tối đa khi chấp nhận hoặc khi có nhóm đăng ký;
          không chặn thao tác nào. Giá trị 0 nghĩa là chưa đặt mức nên chưa cảnh
          báo.
        </p>
        {!infoLocked && (loadError || loadSaveError) && (
          <p id="round-load-error" className="rnd-field-err" role="alert">
            {loadError ?? loadSaveError}
          </p>
        )}
        {!infoLocked && (
          <div className="rnd-info-actions">
            <button
              type="button"
              className="rnd-btn rnd-btn-primary"
              disabled={!loadDirty || !!loadError || loadSaving}
              aria-busy={loadSaving}
              onClick={() => void saveLoad()}
            >
              {loadSaving ? 'Đang lưu...' : 'Lưu số đề tài'}
            </button>
          </div>
        )}
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
                      {m.allowLate ? (
                        <label className="rnd-late-end">
                          <span>Hạn nộp trễ</span>
                          <input
                            type="date"
                            className="rnd-date"
                            aria-label={`Hạn nộp trễ ${m.name}`}
                            value={m.lateEndDate ?? ''}
                            min={m.endDate || undefined}
                            disabled={readOnly}
                            onChange={(e) =>
                              patch(m.key, { lateEndDate: e.target.value })
                            }
                            {...invalidProps}
                          />
                          {!readOnly && !(m.lateEndDate ?? '').trim() ? (
                            <span className="rnd-late-missing">
                              Chưa đặt: sau hạn thường sẽ không nhận bài.
                            </span>
                          ) : null}
                        </label>
                      ) : null}
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
