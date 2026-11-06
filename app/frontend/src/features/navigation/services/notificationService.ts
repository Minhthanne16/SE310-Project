import { apiRequest } from '@/api/request';

export type NotificationKind =
  | 'assign'
  | 'success'
  | 'reject'
  | 'schedule'
  | 'comment'
  | 'deadline'
  | 'result'
  | 'inbox'
  | 'post';

export interface BellNotification {
  id: string;
  kind: NotificationKind;
  text: string;
  from: string;
  href: string;
  // ISO 8601.
  createdAt: string;
  unread: boolean;
}

export interface NotificationService {
  list(): Promise<BellNotification[]>;
  markRead(ids: string[]): Promise<void>;
}

// Hình dạng NotificationDto của backend.
interface NotificationDto {
  id: string;
  kind: NotificationKind;
  text: string;
  from: string;
  href: string;
  createdAt: string;
  isRead: boolean;
}

// Người nhận do backend lấy từ phiên đăng nhập.
export const notificationService: NotificationService = {
  async list() {
    const rows = await apiRequest<NotificationDto[]>('/notifications/me');
    return rows.map(({ isRead, ...row }) => ({ ...row, unread: !isRead }));
  },
  async markRead(ids) {
    await apiRequest<number>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const pad = (n: number) => String(n).padStart(2, '0');

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const notificationGroup = (
  createdAt: string,
  now: Date = new Date(),
): 'today' | 'earlier' =>
  isSameDay(new Date(createdAt), now) ? 'today' : 'earlier';

// "15 phút trước" trong ngày; "Hôm qua, 20:15"; còn lại "12/10".
export function notificationTime(
  createdAt: string,
  now: Date = new Date(),
): string {
  const at = new Date(createdAt);
  if (isSameDay(at, now)) {
    const elapsed = now.getTime() - at.getTime();
    if (elapsed < MINUTE) return 'Vừa xong';
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} phút trước`;
    return `${Math.floor(elapsed / HOUR)} giờ trước`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(at, yesterday))
    return `Hôm qua, ${pad(at.getHours())}:${pad(at.getMinutes())}`;
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}`;
}
