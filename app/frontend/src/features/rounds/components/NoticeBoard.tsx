'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search, SquarePen } from 'lucide-react';
import { initials } from '@/features/navigation/initials';
import { formatDateTime } from '@/features/rounds/roundUtils';
import type { RoundService } from '@/features/rounds/services/roundService';
import type { NoticeFilter, RoundNotification } from '@/types/round';

interface NoticeBoardProps {
  roundId: string;
  roundService: RoundService;
}

const FILTERS: { id: NoticeFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'giaovu', label: 'Từ giáo vụ' },
  { id: 'mine', label: 'Tôi đã gửi' },
];

const PAGE = 5;

// Bảng thông báo của một đợt (03: Trang chủ): lọc theo nguồn, tìm theo tiêu đề
// hoặc người gửi, bấm để mở nội dung, "Xem thêm". Không có trả lời, không có số
// người đã xem.
export const NoticeBoard: React.FC<NoticeBoardProps> = ({
  roundId,
  roundService,
}) => {
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [items, setItems] = useState<RoundNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    roundService
      .listNotifications({ roundId, source: filter, search, limit })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được thông báo.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roundService, roundId, filter, search, limit]);

  const remaining = total - items.length;

  return (
    <section className="notice-board" aria-labelledby="notice-board-title">
      <div className="notice-header">
        <div className="notice-header-text">
          <h2 id="notice-board-title">Bảng thông báo</h2>
          <span>
            Thông báo từ giáo vụ và giảng viên, mới nhất ở trên. Thông báo tự
            động của hệ thống xem ở chuông.
          </span>
        </div>
        <div className="notice-header-actions">
          <label className="notice-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm thông báo"
              placeholder="Tìm theo tiêu đề, người gửi"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <Link className="notice-compose" href="/giao-vu/thong-bao/gui">
            <SquarePen size={16} aria-hidden="true" />
            Soạn thông báo
          </Link>
        </div>
      </div>

      <div className="notice-tabs" role="group" aria-label="Lọc theo nguồn">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setLimit(PAGE);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="notice-empty notice-error">
          {error}
        </p>
      ) : loading && items.length === 0 ? (
        <p role="status" className="notice-empty">
          Đang tải thông báo...
        </p>
      ) : items.length === 0 ? (
        <p className="notice-empty">Không có thông báo phù hợp.</p>
      ) : (
        <ul className="notice-list">
          {items.map((n) => {
            const open = openId === n.id;
            const fromAffairs = n.source === 'Từ giáo vụ';
            return (
              <li key={n.id} className={`notice-item${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="notice-head"
                  aria-expanded={open}
                  aria-controls={open ? `notice-body-${n.id}` : undefined}
                  onClick={() => setOpenId(open ? null : n.id)}
                >
                  <span
                    className={`notice-avatar avatar ${fromAffairs ? 'avatar-AcademicAffairs' : 'avatar-Lecturer'}`}
                    aria-hidden="true"
                  >
                    {fromAffairs ? 'GV' : initials(n.sender)}
                  </span>
                  <span className="notice-main">
                    <span className="notice-title">{n.title}</span>
                    <span className="notice-meta">
                      <strong>{n.sender}</strong>
                      <span
                        className={
                          fromAffairs
                            ? 'notice-role notice-role-affairs'
                            : 'notice-role notice-role-lecturer'
                        }
                      >
                        {n.mine
                          ? 'Bạn'
                          : fromAffairs
                            ? 'Giáo vụ'
                            : 'Giảng viên'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(n.createdAt)}</span>
                    </span>
                    {!open && <span className="notice-excerpt">{n.body}</span>}
                  </span>
                  <ChevronDown
                    className="notice-chevron"
                    size={18}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <p id={`notice-body-${n.id}`} className="notice-body">
                    {n.body}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {remaining > 0 && (
        <button
          type="button"
          className="notice-more"
          onClick={() => setLimit((l) => l + PAGE)}
        >
          Xem thêm {remaining} thông báo cũ hơn
        </button>
      )}
    </section>
  );
};
