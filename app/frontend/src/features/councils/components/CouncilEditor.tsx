'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import {
  addSlot,
  autoFill,
  DEFAULT_SLOT_MINUTES,
  fieldErrors,
  formatDay,
  moveSlot,
  removeSlot,
  setSlotTime,
  slotErrors,
  supervisorInCouncil,
  type CouncilDraft,
} from '@/features/councils/councilDraft';
import type { CouncilBoard, CouncilPoolTopic } from '@/types/council';

interface CouncilEditorProps {
  draft: CouncilDraft;
  board: CouncilBoard;
  // Đề tài có thể thêm (kho chưa xếp + đề tài vừa bỏ khỏi chính hội đồng này).
  pool: CouncilPoolTopic[];
  // Xung đột máy chủ trả về khi xem trước; null khi chưa kiểm tra.
  problems: string[] | null;
  checking: boolean;
  busy: boolean;
  // Đã bấm Lưu một lần: hiện lỗi thiếu trường.
  submitted: boolean;
  onChange: (draft: CouncilDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}

type FieldKey = 'name' | 'chair' | 'secretary' | 'date' | 'room' | 'reason';

// Chế độ sửa của hội đồng (DESIGN/03 · Hội đồng bảo vệ, PDR-017/018). Giờ từng lượt do Giáo vụ nhập; "Điền giờ tự
// động" chỉ điền sẵn rồi sửa được từng lượt.
export const CouncilEditor: React.FC<CouncilEditorProps> = ({
  draft,
  board,
  pool,
  problems,
  checking,
  busy,
  submitted,
  onChange,
  onCancel,
  onSave,
}) => {
  const [fillStart, setFillStart] = useState(draft.slots[0]?.start ?? '07:30');
  const [fillMinutes, setFillMinutes] = useState(String(DEFAULT_SLOT_MINUTES));
  const [fillError, setFillError] = useState<string | null>(null);

  const fields = submitted ? fieldErrors(draft) : {};
  const times = slotErrors(draft);
  const set = (patch: Partial<CouncilDraft>) =>
    onChange({ ...draft, ...patch });
  const error = (key: FieldKey) =>
    fields[key] ? (
      <p id={`cnc-${key}-error`} role="alert" className="tpc-form-error">
        {fields[key]}
      </p>
    ) : null;
  const aria = (key: FieldKey) => ({
    'aria-invalid': fields[key] ? true : undefined,
    'aria-describedby': fields[key] ? `cnc-${key}-error` : undefined,
  });

  const runFill = () => {
    const result = autoFill(draft, fillStart, Number(fillMinutes));
    if (!result.ok) {
      setFillError(result.error);
      return;
    }
    setFillError(null);
    onChange(result.draft);
  };

  const defenseWindow = board.round.defenseStart
    ? `Thời gian bảo vệ của đợt: ${formatDay(board.round.defenseStart)} – ${formatDay(board.round.defenseEnd)}.`
    : null;

  return (
    <div className="cnc-editor">
      <div className="cnc-form-grid">
        <div className="tpc-form-field">
          <label htmlFor="cnc-name">Tên hội đồng</label>
          <input
            id="cnc-name"
            value={draft.name}
            maxLength={100}
            disabled={busy}
            {...aria('name')}
            onChange={(e) => set({ name: e.target.value })}
          />
          {error('name')}
        </div>
        <div className="tpc-form-field">
          <label htmlFor="cnc-room">Phòng</label>
          <input
            id="cnc-room"
            value={draft.room}
            maxLength={50}
            placeholder="VD: B4.12"
            disabled={busy}
            {...aria('room')}
            onChange={(e) => set({ room: e.target.value })}
          />
          {error('room')}
        </div>
        <div className="tpc-form-field">
          <label htmlFor="cnc-chair">Chủ tịch</label>
          <select
            id="cnc-chair"
            className="app-select"
            value={draft.chairId}
            disabled={busy}
            {...aria('chair')}
            onChange={(e) => set({ chairId: e.target.value })}
          >
            <option value="">Chọn giảng viên</option>
            {board.lecturers.map((l) => (
              <option
                key={l.id}
                value={l.id}
                disabled={l.id === draft.secretaryId}
              >
                {`${l.name} (${l.code})`}
              </option>
            ))}
          </select>
          {error('chair')}
        </div>
        <div className="tpc-form-field">
          <label htmlFor="cnc-secretary">Thư ký (nhập điểm hội đồng)</label>
          <select
            id="cnc-secretary"
            className="app-select"
            value={draft.secretaryId}
            disabled={busy}
            {...aria('secretary')}
            onChange={(e) => set({ secretaryId: e.target.value })}
          >
            <option value="">Chọn giảng viên</option>
            {board.lecturers.map((l) => (
              <option key={l.id} value={l.id} disabled={l.id === draft.chairId}>
                {`${l.name} (${l.code})`}
              </option>
            ))}
          </select>
          {error('secretary')}
        </div>
        <div className="tpc-form-field">
          <label htmlFor="cnc-date">Ngày bảo vệ</label>
          <input
            id="cnc-date"
            type="date"
            value={draft.date}
            min={board.round.defenseStart || undefined}
            disabled={busy}
            {...aria('date')}
            aria-describedby={
              [
                fields.date ? 'cnc-date-error' : null,
                defenseWindow ? 'cnc-date-hint' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(e) => set({ date: e.target.value })}
          />
          {defenseWindow && (
            <p id="cnc-date-hint" className="cnc-hint">
              {defenseWindow}
            </p>
          )}
          {error('date')}
        </div>
      </div>

      <section className="cnc-fill" aria-labelledby="cnc-fill-title">
        <h3 id="cnc-fill-title">Điền giờ tự động</h3>
        <p className="cnc-hint">
          Điền sẵn các lượt nối tiếp nhau. Sau đó vẫn sửa được giờ bắt đầu, kết
          thúc của từng lượt.
        </p>
        <div className="cnc-fill-row">
          <div className="tpc-form-field">
            <label htmlFor="cnc-fill-start">Giờ bắt đầu</label>
            <input
              id="cnc-fill-start"
              className="cnc-time"
              value={fillStart}
              placeholder="HH:MM"
              disabled={busy}
              onChange={(e) => setFillStart(e.target.value)}
            />
          </div>
          <div className="tpc-form-field">
            <label htmlFor="cnc-fill-minutes">Phút mỗi đề tài</label>
            <input
              id="cnc-fill-minutes"
              className="cnc-time"
              inputMode="numeric"
              value={fillMinutes}
              disabled={busy}
              onChange={(e) => setFillMinutes(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="app-button"
            onClick={runFill}
            disabled={busy || draft.slots.length === 0}
            aria-describedby={fillError ? 'cnc-fill-error' : undefined}
          >
            Điền giờ
          </button>
        </div>
        {fillError && (
          <p id="cnc-fill-error" role="alert" className="tpc-form-error">
            {fillError}
          </p>
        )}
      </section>

      <section aria-labelledby="cnc-slots-title" className="cnc-section">
        <h3 id="cnc-slots-title">{`Đề tài bảo vệ (${draft.slots.length})`}</h3>
        {draft.slots.length === 0 ? (
          <p className="cnc-hint">
            Chưa có đề tài nào. Thêm đề tài từ danh sách bên dưới.
          </p>
        ) : (
          <ol className="cnc-slot-list">
            {draft.slots.map((slot, i) => {
              const bad = supervisorInCouncil(draft, slot.supervisorId);
              const errorId = `cnc-slot-${slot.topicId}-error`;
              const message =
                times[slot.topicId] ??
                (bad ? 'GVHD đang ngồi hội đồng này.' : null);
              return (
                <li
                  key={slot.topicId}
                  className="cnc-slot"
                  data-warn={bad || Boolean(times[slot.topicId])}
                >
                  <span className="cnc-slot-order" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="cnc-slot-main">
                    <span className="cnc-slot-title">{`${slot.code} · ${slot.title}`}</span>
                    <span className="cnc-slot-meta">
                      {`${slot.groupText} · HD ${slot.supervisorName} · PB ${slot.reviewerName ?? 'chưa phân công'}`}
                    </span>
                    {message && (
                      <span
                        id={errorId}
                        role="alert"
                        className="cnc-slot-error"
                      >
                        {message}
                      </span>
                    )}
                  </div>
                  <div className="cnc-slot-times">
                    <label
                      className="app-visually-hidden"
                      htmlFor={`cnc-start-${slot.topicId}`}
                    >{`Giờ bắt đầu ${slot.code}`}</label>
                    <input
                      id={`cnc-start-${slot.topicId}`}
                      className="cnc-time"
                      value={slot.start}
                      placeholder="HH:MM"
                      disabled={busy}
                      aria-invalid={times[slot.topicId] ? true : undefined}
                      aria-describedby={message ? errorId : undefined}
                      onChange={(e) =>
                        onChange(
                          setSlotTime(
                            draft,
                            slot.topicId,
                            'start',
                            e.target.value,
                          ),
                        )
                      }
                    />
                    <span aria-hidden="true">–</span>
                    <label
                      className="app-visually-hidden"
                      htmlFor={`cnc-end-${slot.topicId}`}
                    >{`Giờ kết thúc ${slot.code}`}</label>
                    <input
                      id={`cnc-end-${slot.topicId}`}
                      className="cnc-time"
                      value={slot.end}
                      placeholder="HH:MM"
                      disabled={busy}
                      aria-invalid={times[slot.topicId] ? true : undefined}
                      aria-describedby={message ? errorId : undefined}
                      onChange={(e) =>
                        onChange(
                          setSlotTime(
                            draft,
                            slot.topicId,
                            'end',
                            e.target.value,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="cnc-slot-actions">
                    <button
                      type="button"
                      className="app-icon-button"
                      aria-label={`Đưa ${slot.code} lên trên`}
                      disabled={busy || i === 0}
                      onClick={() => onChange(moveSlot(draft, i, -1))}
                    >
                      <ArrowUp size={18} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="app-icon-button"
                      aria-label={`Đưa ${slot.code} xuống dưới`}
                      disabled={busy || i === draft.slots.length - 1}
                      onClick={() => onChange(moveSlot(draft, i, 1))}
                    >
                      <ArrowDown
                        size={18}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className="app-icon-button"
                      aria-label={`Bỏ ${slot.code} khỏi hội đồng`}
                      disabled={busy}
                      onClick={() => onChange(removeSlot(draft, slot.topicId))}
                    >
                      <X size={18} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="cnc-pool-title" className="cnc-section">
        <h3 id="cnc-pool-title">{`Đề tài chưa xếp hội đồng (${pool.length})`}</h3>
        <p className="cnc-hint">
          Đề tài có giảng viên hướng dẫn nằm trong hội đồng này không thêm được.
        </p>
        {pool.length === 0 ? (
          <p className="cnc-hint">
            Tất cả đề tài đủ điều kiện của đợt đã có hội đồng.
          </p>
        ) : (
          <ul className="cnc-pool">
            {pool.map((topic) => {
              const blocked = supervisorInCouncil(draft, topic.supervisor.id);
              return (
                <li key={topic.topicId} className="cnc-pool-item">
                  <div className="cnc-slot-main">
                    <span className="cnc-slot-title">{`${topic.code} · ${topic.title}`}</span>
                    <span className="cnc-slot-meta">
                      {`HD ${topic.supervisor.name} · PB ${topic.reviewer?.name ?? 'chưa phân công'} · ${topic.thesisVersionCount > 0 ? `đã nộp ${topic.thesisVersionCount} bản khóa luận` : 'chưa nộp khóa luận'}`}
                    </span>
                  </div>
                  {blocked ? (
                    <span className="app-chip app-chip-pending">
                      GVHD trong hội đồng
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="app-button app-button-small"
                      disabled={busy}
                      onClick={() => onChange(addSlot(draft, topic))}
                    >
                      {`Thêm ${topic.code} vào lịch`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {draft.published && (
        <div className="tpc-form-field">
          <label htmlFor="cnc-reason">Lý do sửa lịch đã công bố</label>
          <textarea
            id="cnc-reason"
            rows={2}
            maxLength={800}
            value={draft.reason}
            disabled={busy}
            {...aria('reason')}
            onChange={(e) => set({ reason: e.target.value })}
          />
          <p className="cnc-hint">
            Hệ thống gửi thông báo thay đổi cho hội đồng, GVHD, GVPB và các nhóm
            bị ảnh hưởng.
          </p>
          {error('reason')}
        </div>
      )}

      <div className="cnc-check" aria-live="polite">
        {checking ? (
          <p role="status" className="cnc-hint">
            Đang kiểm tra trùng phòng, trùng giảng viên…
          </p>
        ) : problems && problems.length > 0 ? (
          <div role="alert" className="cnc-conflicts">
            <strong>{`Còn ${problems.length} xung đột, chưa lưu được:`}</strong>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : problems ? (
          <p role="status" className="cnc-ok">
            Không có xung đột với các hội đồng khác.
          </p>
        ) : null}
      </div>

      <div className="cnc-actions">
        <button
          type="button"
          className="app-button"
          onClick={onCancel}
          disabled={busy}
        >
          Hủy
        </button>
        <button
          type="button"
          className="app-button app-button-primary"
          onClick={onSave}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Đang lưu...' : 'Lưu hội đồng'}
        </button>
      </div>
    </div>
  );
};
