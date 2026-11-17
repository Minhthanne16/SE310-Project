'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '@/features/topics/topics.css';
import '@/features/reviewers/reviewers.css';
import {
  reviewerService as defaultService,
  type ReviewerService,
} from '@/features/reviewers/services/reviewerService';
import { formatDateTime } from '@/features/rounds/roundUtils';
import type { MyReviews } from '@/types/reviewer';

interface ReviewerTopicsPageProps {
  service?: Pick<ReviewerService, 'mine'>;
}

type Filter = 'all' | 'todo';

const errorText = (err: unknown) =>
  err instanceof Error && err.message
    ? err.message
    : 'Không tải được đề tài phản biện.';

// /gv/phan-bien: đề tài Giáo vụ phân công cho giảng viên phản biện (DESIGN/03, PDR-021/022/062).
// Chỉ xem; phiếu chấm thuộc P07. Trạng thái: Chưa chấm, Chưa đủ điều kiện chấm (kèm lý do), Đã chấm.
export const ReviewerTopicsPage: React.FC<ReviewerTopicsPageProps> = ({
  service = defaultService,
}) => {
  const [data, setData] = useState<MyReviews | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

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

  const items = useMemo(() => data?.items ?? [], [data]);
  const todo = items.filter((i) => !i.scored);
  const shown = filter === 'todo' ? todo : items;

  if (error && !data)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài phản biện</h2>
        <p>{error}</p>
      </section>
    );
  if (!data)
    return (
      <p role="status" className="app-muted">
        Đang tải đề tài phản biện…
      </p>
    );

  return (
    <div className="rvw-page">
      {data.rounds.length > 1 && (
        <div className="tpc-round-row">
          <label htmlFor="pb-mine-round">Đợt</label>
          <select
            id="pb-mine-round"
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
      <div className="app-page-heading">
        <h1>Đề tài phản biện</h1>
        <p>
          Đề tài Giáo vụ phân công bạn phản biện. Bạn chỉ xem đề cương và bài
          nộp; chấm điểm được mở sau khi nhóm nộp báo cáo cuối kỳ.
        </p>
      </div>

      {items.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa được phân công</h2>
          <p>Bạn chưa được phân công phản biện đề tài nào trong đợt này.</p>
        </section>
      ) : (
        <>
          <div className="app-segmented" role="group" aria-label="Lọc đề tài">
            <button
              type="button"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              {`Tất cả (${items.length})`}
            </button>
            <button
              type="button"
              aria-pressed={filter === 'todo'}
              onClick={() => setFilter('todo')}
            >
              {`Chưa chấm (${todo.length})`}
            </button>
          </div>
          {shown.length === 0 ? (
            <p className="app-muted">Không còn đề tài nào chưa chấm.</p>
          ) : (
            <div className="app-table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th scope="col">Mã</th>
                    <th scope="col">Đề tài</th>
                    <th scope="col">Nhóm</th>
                    <th scope="col">GVHD</th>
                    <th scope="col">Ngày phân công</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">
                      <span className="app-visually-hidden">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <tr key={item.topicId}>
                      <td className="rvw-nowrap">{item.code}</td>
                      <td className="rvw-cell-title">{item.title}</td>
                      <td>
                        {item.group.length > 0
                          ? item.group
                              .map((m) => `${m.name} (${m.code})`)
                              .join(', ')
                          : '—'}
                      </td>
                      <td>{item.supervisor.name}</td>
                      <td className="rvw-nowrap">
                        {item.assignedAt
                          ? formatDateTime(item.assignedAt).slice(0, 10)
                          : '—'}
                      </td>
                      <td>
                        {item.scored ? (
                          <span className="app-chip app-chip-active">
                            Đã chấm
                          </span>
                        ) : item.canScore ? (
                          <span className="app-chip app-chip-info">
                            Chưa chấm
                          </span>
                        ) : (
                          <>
                            <span className="app-chip app-chip-pending">
                              Chưa đủ điều kiện chấm
                            </span>
                            {item.scoreBlockedReason && (
                              <span className="rvw-cell-note">
                                {item.scoreBlockedReason}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/de-tai/${encodeURIComponent(item.topicId)}`}
                          className="app-button app-button-small"
                          aria-label={`Mở ${item.code} ${item.title}`}
                        >
                          Mở
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
