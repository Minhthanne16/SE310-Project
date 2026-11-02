'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import '@/features/rounds/rounds.css';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  topicService as defaultTopicService,
  type TopicService,
} from '@/features/topics/services/topicService';
import {
  groupLabel,
  shortName,
  thesisCell,
} from '@/features/topics/topicUtils';
import { TOPIC_STATUSES, type Round, type TopicStatus } from '@/types/round';
import type { Topic } from '@/types/topic';

interface RoundTopicsTabProps {
  round: Round;
  topicService?: TopicService;
}

const normalize = (value: string) => value.trim().toLowerCase();

// Tab Đề tài của chi tiết đợt (artboard GiaoVu-DotKhoaLuan): giáo vụ xem đề tài
// của đợt ngay tại đây; công bố danh sách, xuất tệp, phân công phản biện và hội
// đồng vẫn làm ở trang Đề tài.
export const RoundTopicsTab: React.FC<RoundTopicsTabProps> = ({
  round,
  topicService = defaultTopicService,
}) => {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TopicStatus | 'Tất cả'>('Tất cả');

  useEffect(() => {
    let cancelled = false;
    setTopics(null);
    setLoadError(null);
    topicService
      .list({ roundId: round.id })
      .then((result) => {
        if (!cancelled) setTopics(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được đề tài của đợt.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [topicService, round.id]);

  const all = useMemo(() => topics ?? [], [topics]);
  const query = normalize(search);

  const rows = useMemo(
    () =>
      all.filter(
        (t) =>
          (status === 'Tất cả' || t.status === status) &&
          (!query ||
            normalize(
              [t.code, t.title, groupLabel(t), t.supervisor.name].join(' '),
            ).includes(query)),
      ),
    [all, status, query],
  );

  // Chỉ liệt kê trạng thái đang có đề tài, kèm số đề tài.
  const filters = useMemo(
    () => [
      { label: 'Tất cả' as const, count: all.length },
      ...TOPIC_STATUSES.filter((s) => all.some((t) => t.status === s)).map(
        (s) => ({ label: s, count: all.filter((t) => t.status === s).length }),
      ),
    ],
    [all],
  );

  if (loadError)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được đề tài</h2>
        <p>{loadError}</p>
      </section>
    );

  if (topics === null)
    return (
      <p role="status" className="rnd-hint">
        Đang tải đề tài...
      </p>
    );

  const clearable = all.length > 0 && (status !== 'Tất cả' || query !== '');
  const empty = rows.length === 0;

  return (
    <div className="rnd-panel" aria-label="Đề tài của đợt">
      <div className="rnd-people-tools" role="search" aria-label="Lọc đề tài">
        <div className="rnd-people-search">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="round-topic-q" className="app-visually-hidden">
            Tìm đề tài
          </label>
          <input
            id="round-topic-q"
            type="search"
            placeholder="Tìm theo mã, tên đề tài hoặc giảng viên"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rnd-select"
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(e) => setStatus(e.target.value as TopicStatus | 'Tất cả')}
        >
          {filters.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label} ({f.count})
            </option>
          ))}
        </select>
        <Link
          className="rnd-btn rnd-btn-lg"
          href={`/giao-vu/de-tai?dot=${encodeURIComponent(round.id)}`}
        >
          Mở trang Đề tài
        </Link>
      </div>

      <span className="rnd-hint" role="status">
        {rows.length} / {all.length} đề tài
      </span>

      <div className="rnd-people-box">
        <table className="rnd-table rnd-table-topics">
          <thead>
            <tr>
              <th scope="col">Đề tài</th>
              <th scope="col">GV hướng dẫn</th>
              <th scope="col">GV phản biện</th>
              <th scope="col">Hội đồng</th>
              <th scope="col">Khóa luận</th>
              <th scope="col">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const thesis = thesisCell(t);
              return (
                <tr key={t.id}>
                  <td>
                    <span className="rnd-person">
                      <Link
                        className="rnd-row-link"
                        href={`/giao-vu/de-tai/${encodeURIComponent(t.id)}`}
                      >
                        {t.title}
                      </Link>
                      <span className="rnd-meta">
                        {t.code} · {groupLabel(t)}
                      </span>
                    </span>
                  </td>
                  <td>{shortName(t.supervisor.name)}</td>
                  <td className={t.reviewer ? '' : 'rnd-cell-warn'}>
                    {t.reviewer ? shortName(t.reviewer.name) : 'Chưa phân công'}
                  </td>
                  <td className={t.council ? '' : 'rnd-cell-warn'}>
                    {t.council ?? 'Chưa gán'}
                  </td>
                  <td>
                    <span className="rnd-person">
                      <b>{thesis.label}</b>
                      <span className="rnd-meta">{thesis.sub}</span>
                    </span>
                  </td>
                  <td>
                    <TopicStatusChip status={t.status} />
                  </td>
                </tr>
              );
            })}
            {empty && (
              <tr>
                <td colSpan={6} className="rnd-empty-cell">
                  <b>
                    {all.length === 0
                      ? 'Chưa có đề tài nào trong đợt'
                      : 'Không có đề tài nào khớp bộ lọc'}
                  </b>
                  <span>
                    {all.length === 0
                      ? round.status === 'Nháp'
                        ? 'Đợt đang Nháp. Đề tài giảng viên gửi và đề tài sinh viên đề xuất sẽ hiện ở đây sau khi đợt bắt đầu.'
                        : 'Đề tài giảng viên gửi và đề tài sinh viên đề xuất được chấp nhận sẽ hiện ở đây.'
                      : 'Thử chọn trạng thái khác hoặc xóa từ khóa tìm kiếm.'}
                  </span>
                  {clearable && (
                    <button
                      type="button"
                      className="rnd-btn rnd-btn-sm"
                      onClick={() => {
                        setSearch('');
                        setStatus('Tất cả');
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="rnd-foot">
        {round.status === 'Đã kết thúc'
          ? 'Đợt đã kết thúc nên danh sách chỉ để xem.'
          : 'Công bố danh sách, xuất tệp và phân công phản biện, hội đồng làm ở trang Đề tài.'}
      </p>
    </div>
  );
};
