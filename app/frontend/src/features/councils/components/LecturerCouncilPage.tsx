'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import '@/features/topics/topics.css';
import '@/features/councils/councils.css';
import { formatDay, groupText, span } from '@/features/councils/councilDraft';
import { statusChipClass } from '@/features/councils/components/CouncilDetail';
import {
  councilService as defaultService,
  type CouncilService,
} from '@/features/councils/services/councilService';
import { formatDateTime } from '@/features/rounds/roundUtils';
import type { CouncilSlot, MyCouncil, MyCouncils } from '@/types/council';

interface LecturerCouncilPageProps {
  service?: Pick<CouncilService, 'mine'>;
}

const errorText = (err: unknown) =>
  err instanceof Error && err.message
    ? err.message
    : 'Không tải được hội đồng bảo vệ.';

function thesisText(slot: CouncilSlot) {
  if (slot.finalLocked)
    return {
      label: 'Chốt bản cuối',
      sub: `${slot.thesisVersionCount} phiên bản`,
      chip: 'app-chip app-chip-active',
    };
  if (slot.thesisVersionCount > 0)
    return {
      label: 'Đã nộp',
      sub: `${slot.thesisVersionCount} phiên bản`,
      chip: 'app-chip app-chip-info',
    };
  return { label: 'Chưa nộp', sub: 'Chưa có phiên bản', chip: 'app-chip' };
}

// /gv/hoi-dong: hội đồng giảng viên là Chủ tịch hoặc Thư ký, sau khi Giáo vụ công bố lịch (DESIGN/03 · Hội đồng bảo
// vệ (giảng viên), PDR-050, PDR-063). Thư ký nhập điểm cho cả hai ở P07; Chủ tịch chỉ xem.
export const LecturerCouncilPage: React.FC<LecturerCouncilPageProps> = ({
  service = defaultService,
}) => {
  const [data, setData] = useState<MyCouncils | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (roundId?: string) => {
      try {
        setError(null);
        setData(await service.mine(roundId));
      } catch (err: unknown) {
        setError(errorText(err));
      }
    },
    [service],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được hội đồng bảo vệ</h2>
        <p>{error}</p>
      </section>
    );
  if (!data)
    return (
      <p role="status" className="app-muted">
        Đang tải hội đồng bảo vệ…
      </p>
    );

  const active = data.councils.filter((c) => c.status !== 'Đã hủy');
  const anyChair = active.some((c) => c.myRole === 'chair');
  const anySecretary = active.some((c) => c.myRole === 'secretary');

  return (
    <div className="cnc-page">
      <div className="app-page-heading">
        <h1>Hội đồng bảo vệ</h1>
        <p>
          Các đề tài bảo vệ trước hội đồng của bạn. Mở một đề tài để xem các
          phiên bản khóa luận
          {anyChair && !anySecretary
            ? ' và điểm. Thư ký nhập điểm cho cả chủ tịch và thư ký; bạn chỉ xem điểm.'
            : ' và điểm hướng dẫn, phản biện; thư ký nhập điểm của chủ tịch và thư ký.'}
        </p>
      </div>

      {data.rounds.length > 1 && (
        <div className="tpc-round-row">
          <label htmlFor="hd-mine-round">Lọc theo đợt</label>
          <select
            id="hd-mine-round"
            className="tpc-select"
            value={data.roundId ?? ''}
            onChange={(e) => void load(e.target.value)}
          >
            {data.rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {data.councils.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Bạn chưa thuộc hội đồng bảo vệ nào</h2>
          <p>
            Khi giáo vụ xếp bạn vào hội đồng và công bố lịch bảo vệ, bạn sẽ nhận
            thông báo và các đề tài cần chấm hiện ở đây.
          </p>
        </section>
      ) : (
        <>
          <p role="note" className="cnc-hint">
            Chức năng nhập điểm và lọc theo điểm chưa khả dụng.
          </p>
          {data.councils.map((council) => (
            <CouncilBlock key={council.id} council={council} />
          ))}
          <p className="cnc-hint">
            {anySecretary
              ? 'Bạn chỉ xem tài liệu và cho điểm. Chủ tịch xem được điểm thư ký đã nhập; điểm sửa được đến khi giáo vụ xác nhận kết quả.'
              : 'Bạn xem tài liệu và điểm, không nhập điểm. Thư ký nhập điểm cho cả chủ tịch và thư ký; muốn chỉnh điểm của bạn thì báo thư ký trước khi giáo vụ xác nhận kết quả.'}
          </p>
        </>
      )}
    </div>
  );
};

const CouncilBlock: React.FC<{ council: MyCouncil }> = ({ council }) => {
  const chair = council.myRole === 'chair';
  const cancelled = council.status === 'Đã hủy';
  const titleId = `hd-${council.id}`;
  return (
    <section className="cnc-mine" aria-labelledby={titleId}>
      <div className="app-card cnc-mine-info" aria-label="Thông tin hội đồng">
        <div>
          <span className="cnc-label">HỘI ĐỒNG</span>
          <span id={titleId} className="cnc-mine-value">
            {council.name}
          </span>
          <span className={statusChipClass(council.status)}>
            {council.status}
          </span>
        </div>
        <div>
          <span className="cnc-label">VAI TRÒ CỦA BẠN</span>
          <span className="cnc-mine-value">
            {chair
              ? 'Chủ tịch · chỉ xem điểm'
              : 'Thư ký · nhập điểm chủ tịch và thư ký'}
          </span>
        </div>
        <div>
          <span className="cnc-label">{chair ? 'THƯ KÝ' : 'CHỦ TỊCH'}</span>
          <span className="cnc-mine-value">
            {chair ? council.secretary.name : council.chair.name}
          </span>
        </div>
        <div>
          <span className="cnc-label">LỊCH BẢO VỆ</span>
          <span className="cnc-mine-value">{`${formatDay(council.date)} · ${span(council.slots) ?? ''} · Phòng ${council.room}`}</span>
        </div>
      </div>

      {cancelled && (
        <p
          role="note"
          className="cnc-note"
        >{`Lịch đã hủy${council.cancelReason ? `. Lý do: ${council.cancelReason}` : ''}.`}</p>
      )}
      {council.corrections.map((c) => (
        <p key={`${c.at}-${c.content}`} role="note" className="cnc-note">
          {`Đính chính (${formatDateTime(c.at)}): ${c.content}${c.reason ? `. Lý do: ${c.reason}` : ''}`}
        </p>
      ))}

      {council.slots.length === 0 ? (
        <p className="app-muted">Hội đồng chưa có đề tài.</p>
      ) : (
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th scope="col">Đề tài · Nhóm</th>
                <th scope="col">Giờ bảo vệ</th>
                <th scope="col">Khóa luận</th>
                <th scope="col">Điểm hội đồng</th>
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {council.slots.map((slot) => {
                const thesis = thesisText(slot);
                return (
                  <tr key={slot.id}>
                    <td>
                      <span className="cnc-slot-title">{slot.title}</span>
                      <span className="cnc-slot-meta">{`${slot.code} · ${groupText(slot.group)}`}</span>
                    </td>
                    <td className="cnc-nowrap">
                      <span className="cnc-slot-title">{`${slot.start}–${slot.end}`}</span>
                      <span className="cnc-slot-meta">{`Thứ tự ${slot.order}`}</span>
                    </td>
                    <td>
                      <span className={thesis.chip}>{thesis.label}</span>
                      <span className="cnc-slot-meta">{thesis.sub}</span>
                    </td>
                    <td>
                      <span className="app-chip app-chip-pending">
                        {chair ? 'Thư ký chưa nhập' : 'Chưa nhập điểm'}
                      </span>
                    </td>
                    <td>
                      {cancelled ? (
                        <span className="app-muted">—</span>
                      ) : (
                        <Link
                          href={`/de-tai/${encodeURIComponent(slot.topicId)}`}
                          className="app-button app-button-small"
                          aria-label={`Mở ${slot.code} ${slot.title}`}
                        >
                          Mở
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
