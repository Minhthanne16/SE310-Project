'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, SquarePen } from 'lucide-react';
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

  return (
    <section className="app-card" aria-labelledby="notice-board-title">
      <div className="app-card-header">
        <h2 id="notice-board-title">Bảng thông báo</h2>
        <Link
          className="app-button app-button-small"
          href="/giao-vu/thong-bao/gui"
        >
          <SquarePen size={14} aria-hidden="true" />
          Soạn thông báo
        </Link>
      </div>

      <div className="app-toolbar">
        <div className="app-segmented" role="group" aria-label="Lọc theo nguồn">
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
        <div className="app-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm thông báo"
            placeholder="Tìm theo tiêu đề hoặc người gửi"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(PAGE);
            }}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="login-field-error">
          {error}
        </p>
      ) : loading && items.length === 0 ? (
        <p role="status" className="app-muted">
          Đang tải thông báo...
        </p>
      ) : items.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Không có thông báo</h2>
          <p>Thử đổi nguồn hoặc từ khóa tìm kiếm.</p>
        </section>
      ) : (
        <ul className="notice-list">
          {items.map((n) => {
            const open = openId === n.id;
            return (
              <li key={n.id} className="notice-item">
                <button
                  type="button"
                  className="notice-head"
                  aria-expanded={open}
                  aria-controls={open ? `notice-body-${n.id}` : undefined}
                  onClick={() => setOpenId(open ? null : n.id)}
                >
                  <span className="notice-title">{n.title}</span>
                  <span className="notice-meta">
                    <span
                      className={
                        n.source === 'Từ giáo vụ'
                          ? 'app-chip app-chip-active'
                          : 'app-chip app-chip-Lecturer'
                      }
                    >
                      {n.mine ? 'Bạn' : n.source}
                    </span>
                    {n.sender} · {formatDateTime(n.createdAt)}
                  </span>
                </button>
                {open ? (
                  <p id={`notice-body-${n.id}`} className="notice-body">
                    {n.body}
                  </p>
                ) : (
                  <p className="notice-excerpt">{n.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {total > items.length && (
        <div>
          <button
            type="button"
            className="app-button"
            onClick={() => setLimit((l) => l + PAGE)}
          >
            Xem thêm
          </button>
        </div>
      )}
    </section>
  );
};
