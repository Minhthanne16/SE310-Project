'use client';

import React from 'react';
import Link from 'next/link';
import { formatDateTime } from '@/features/rounds/roundUtils';
import { formatDay, groupText, span } from '@/features/councils/councilDraft';
import type { Council } from '@/types/council';

interface CouncilDetailProps {
  council: Council;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCancelSchedule: () => void;
  onCorrect: () => void;
}

export const statusChipClass = (status: string) =>
  status === 'Đã công bố'
    ? 'app-chip app-chip-active'
    : status === 'Đã hủy'
      ? 'app-chip app-chip-error'
      : 'app-chip';

// Chế độ xem của một hội đồng trên màn Giáo vụ: thông tin, xung đột hiện tại, lượt bảo vệ, đính chính và lịch sử.
export const CouncilDetail: React.FC<CouncilDetailProps> = ({
  council,
  busy,
  onEdit,
  onDelete,
  onCancelSchedule,
  onCorrect,
}) => {
  const when = span(council.slots);
  return (
    <div className="cnc-detail-body">
      <div className="cnc-detail-actions">
        {council.canEdit && (
          <button
            type="button"
            className="app-button"
            onClick={onEdit}
            disabled={busy}
          >
            Sửa
          </button>
        )}
        {council.status === 'Nháp' && (
          <button
            type="button"
            className="app-button app-button-danger"
            onClick={onDelete}
            disabled={busy || !council.canDelete}
          >
            Xóa
          </button>
        )}
        {council.canCancel && (
          <button
            type="button"
            className="app-button app-button-danger"
            onClick={onCancelSchedule}
            disabled={busy}
          >
            Hủy lịch
          </button>
        )}
        {council.canCorrect && (
          <button
            type="button"
            className="app-button"
            onClick={onCorrect}
            disabled={busy}
          >
            Ghi đính chính
          </button>
        )}
      </div>
      {council.status !== 'Nháp' &&
        !council.canEdit &&
        council.editBlockedReason && (
          <p role="note" className="cnc-note">
            {council.editBlockedReason}
          </p>
        )}
      {council.status === 'Đã công bố' && council.canEdit && (
        <p role="note" className="cnc-note">
          Đã công bố · không xóa được để lưu vết. Sửa lịch cần lý do và hệ thống
          gửi thông báo thay đổi; hủy lịch nếu buổi bảo vệ không diễn ra.
        </p>
      )}
      {council.status === 'Đã hủy' && (
        <p
          role="note"
          className="cnc-note"
        >{`Lịch đã hủy${council.cancelReason ? `. Lý do: ${council.cancelReason}` : ''}.`}</p>
      )}

      <dl className="cnc-dl">
        <div>
          <dt>Chủ tịch</dt>
          <dd>{`${council.chair.name} (${council.chair.code})`}</dd>
        </div>
        <div>
          <dt>Thư ký (nhập điểm hội đồng)</dt>
          <dd>{`${council.secretary.name} (${council.secretary.code})`}</dd>
        </div>
        <div>
          <dt>Ngày bảo vệ</dt>
          <dd>{formatDay(council.date)}</dd>
        </div>
        <div>
          <dt>Phòng</dt>
          <dd>{council.room}</dd>
        </div>
        <div>
          <dt>Giờ</dt>
          <dd>{when ?? 'Chưa có đề tài'}</dd>
        </div>
      </dl>

      {council.conflicts.length > 0 && (
        <div role="alert" className="cnc-conflicts">
          <strong>{`${council.conflicts.length} xung đột · chưa công bố được`}</strong>
          <ul>
            {council.conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {council.status === 'Nháp' &&
        council.publishBlockedReason &&
        council.conflicts.length === 0 && (
          <p role="note" className="cnc-note">
            {council.publishBlockedReason}
          </p>
        )}

      {council.slots.length === 0 ? (
        <section className="status-state app-empty">
          <h3>Chưa có đề tài</h3>
          <p>Bấm Sửa để thêm đề tài vào hội đồng.</p>
        </section>
      ) : (
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Giờ</th>
                <th scope="col">Đề tài</th>
                <th scope="col">Nhóm</th>
                <th scope="col">Hướng dẫn · Phản biện</th>
              </tr>
            </thead>
            <tbody>
              {council.slots.map((slot) => (
                <tr key={slot.id}>
                  <td>{slot.order}</td>
                  <td className="cnc-nowrap">{`${slot.start}–${slot.end}`}</td>
                  <td>
                    <Link
                      href={`/giao-vu/de-tai/${encodeURIComponent(slot.topicId)}`}
                      className="app-link"
                    >
                      {`${slot.code} · ${slot.title}`}
                    </Link>
                  </td>
                  <td>{groupText(slot.group)}</td>
                  <td>{`HD ${slot.supervisor.name} · PB ${slot.reviewer?.name ?? 'chưa phân công'}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {council.corrections.length > 0 && (
        <section
          aria-labelledby={`cnc-corr-${council.id}`}
          className="cnc-section"
        >
          <h3 id={`cnc-corr-${council.id}`}>Đính chính</h3>
          <ul className="cnc-log">
            {council.corrections.map((c) => (
              <li key={`${c.at}-${c.content}`}>
                <span className="cnc-log-head">{`${formatDateTime(c.at)} · ${c.by}`}</span>
                <span>{c.content}</span>
                {c.reason && (
                  <span className="cnc-hint">{`Lý do: ${c.reason}`}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {council.history.length > 0 && (
        <details className="cnc-history">
          <summary>{`Lịch sử thay đổi (${council.history.length})`}</summary>
          <ul className="cnc-log">
            {council.history.map((h) => (
              <li key={h.id}>
                <span className="cnc-log-head">{`${formatDateTime(h.at)} · ${h.actor} · ${h.action}`}</span>
                {h.reason && <span>{`Lý do: ${h.reason}`}</span>}
                {h.detail && <span className="cnc-log-detail">{h.detail}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
