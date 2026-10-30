'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock,
  Inbox,
  Megaphone,
  MessageSquare,
  X,
  type LucideIcon,
} from 'lucide-react';
import '@/features/navigation/navigation.css';
import {
  notificationService as defaultService,
  type BellNotification,
  type NotificationAudience,
  type NotificationKind,
  type NotificationService,
} from '@/features/navigation/services/notificationService';

interface NotificationBellProps {
  audience: NotificationAudience;
  service?: NotificationService;
}

const ICONS: Record<NotificationKind, LucideIcon> = {
  assign: ClipboardCheck,
  success: Check,
  reject: X,
  schedule: CalendarDays,
  comment: MessageSquare,
  deadline: Clock,
  result: Award,
  inbox: Inbox,
  post: Megaphone,
};

const GROUPS: { id: BellNotification['group']; label: string }[] = [
  { id: 'today', label: 'HÔM NAY' },
  { id: 'earlier', label: 'TRƯỚC ĐÓ' },
];

type Tab = 'all' | 'unread';

// Chuông ở thanh trên (artboard ThongBaoMenu): thông báo tự động và thông báo
// được gửi, đánh dấu đã đọc, lọc Chưa đọc.
export const NotificationBell: React.FC<NotificationBellProps> = ({
  audience,
  service = defaultService,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<BellNotification[]>([]);
  const [failed, setFailed] = useState(false);
  const popupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    service
      .list(audience)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [service, audience]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = items.filter((n) => n.unread).length;
  const shown = useMemo(
    () => items.filter((n) => tab === 'all' || n.unread),
    [items, tab],
  );
  const groups = GROUPS.map((g) => ({
    ...g,
    items: shown.filter((n) => n.group === g.id),
  })).filter((g) => g.items.length > 0);

  const markRead = (ids: string[]) => {
    const pending = ids.filter((id) => items.find((n) => n.id === id)?.unread);
    if (pending.length === 0) return;
    setItems((list) =>
      list.map((n) => (pending.includes(n.id) ? { ...n, unread: false } : n)),
    );
    void service.markRead(pending).catch(() => undefined);
  };

  return (
    <div className="bell" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`bell-button${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
        {unread > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label="Thông báo"
          className="bell-popup"
        >
          <div className="bell-head">
            <h2>Thông báo</h2>
            <button
              type="button"
              className="bell-mark-all"
              disabled={unread === 0}
              onClick={() => markRead(items.map((n) => n.id))}
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>
          <div className="bell-tabs" role="group" aria-label="Lọc thông báo">
            <button
              type="button"
              aria-pressed={tab === 'all'}
              onClick={() => setTab('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              aria-pressed={tab === 'unread'}
              onClick={() => setTab('unread')}
            >
              Chưa đọc ({unread})
            </button>
          </div>
          <div className="bell-list">
            {failed ? (
              <p className="bell-empty" role="alert">
                Không tải được thông báo.
              </p>
            ) : groups.length === 0 ? (
              <p className="bell-empty">Bạn đã đọc hết thông báo.</p>
            ) : (
              groups.map((g) => (
                <div key={g.id}>
                  <div className="bell-group">{g.label}</div>
                  {g.items.map((n) => {
                    const Icon = ICONS[n.kind];
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        className={`bell-item${n.unread ? ' is-unread' : ''}`}
                        onClick={() => {
                          markRead([n.id]);
                          setOpen(false);
                        }}
                      >
                        <span
                          className={`bell-icon bell-icon-${n.kind}`}
                          aria-hidden="true"
                        >
                          <Icon size={18} strokeWidth={1.9} />
                        </span>
                        <span className="bell-item-text">
                          <span className="bell-item-title">{n.text}</span>
                          <span className="bell-item-meta">
                            {n.from} · {n.time}
                          </span>
                        </span>
                        {n.unread && (
                          <span
                            className="bell-dot"
                            role="img"
                            aria-label="Chưa đọc"
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
