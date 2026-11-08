'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  notificationGroup,
  notificationService as defaultService,
  notificationTime,
  type BellNotification,
  type NotificationKind,
  type NotificationService,
} from '@/features/navigation/services/notificationService';

interface NotificationBellProps {
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

const GROUPS: { id: 'today' | 'earlier'; label: string }[] = [
  { id: 'today', label: 'HÔM NAY' },
  { id: 'earlier', label: 'TRƯỚC ĐÓ' },
];

type Tab = 'all' | 'unread';

// Chuông ở thanh trên (artboard ThongBaoMenu): thông báo tự động và thông báo
// được gửi, đánh dấu đã đọc, lọc Chưa đọc. Dữ liệu lấy từ API theo phiên đăng nhập.
export const NotificationBell: React.FC<NotificationBellProps> = ({
  service = defaultService,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<BellNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);
  const popupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Chỉ phản hồi của lần tải mới nhất được áp dụng.
  const latestLoad = useRef(0);
  const load = useCallback(() => {
    const id = ++latestLoad.current;
    setFailed(false);
    setLoading(true);
    service
      .list()
      .then((list) => {
        if (id === latestLoad.current) setItems(list);
      })
      .catch(() => {
        if (id === latestLoad.current) setFailed(true);
      })
      .finally(() => {
        if (id === latestLoad.current) setLoading(false);
      });
  }, [service]);

  useEffect(() => {
    load();
    return () => {
      latestLoad.current++;
    };
  }, [load]);

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
    items: shown.filter((n) => notificationGroup(n.createdAt) === g.id),
  })).filter((g) => g.items.length > 0);

  const markRead = (ids: string[]) => {
    const pending = ids.filter((id) => items.find((n) => n.id === id)?.unread);
    if (pending.length === 0) return;
    setItems((list) =>
      list.map((n) => (pending.includes(n.id) ? { ...n, unread: false } : n)),
    );
    setMarkFailed(false);
    // Lưu không được thì trả lại trạng thái chưa đọc, không báo đã đọc khi chưa lưu.
    service.markRead(pending).catch(() => {
      setItems((list) =>
        list.map((n) => (pending.includes(n.id) ? { ...n, unread: true } : n)),
      );
      setMarkFailed(true);
    });
  };

  const toggle = () => {
    // Mở ra thì tải lại để thấy thông báo mới phát sinh trong phiên làm việc.
    if (!open) load();
    setOpen(!open);
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
        onClick={toggle}
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
          {markFailed && (
            <p className="bell-error" role="alert">
              Chưa đánh dấu đã đọc được. Thử lại sau.
            </p>
          )}
          <div className="bell-list" aria-busy={loading}>
            {failed ? (
              <div className="bell-empty" role="alert">
                <p>Không tải được thông báo.</p>
                <button type="button" className="bell-retry" onClick={load}>
                  Thử lại
                </button>
              </div>
            ) : groups.length === 0 ? (
              loading ? (
                <p className="bell-empty" role="status">
                  Đang tải thông báo...
                </p>
              ) : (
                <p className="bell-empty">
                  {tab === 'unread'
                    ? 'Bạn đã đọc hết thông báo.'
                    : 'Chưa có thông báo nào.'}
                </p>
              )
            ) : (
              groups.map((g) => (
                <div key={g.id}>
                  <div className="bell-group">{g.label}</div>
                  {g.items.map((n) => {
                    const Icon = ICONS[n.kind] ?? Megaphone;
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
                            {n.from} · {notificationTime(n.createdAt)}
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
