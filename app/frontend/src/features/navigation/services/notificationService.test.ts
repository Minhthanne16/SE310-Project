import { afterEach, expect, it, vi } from 'vitest';
import {
  notificationGroup,
  notificationService,
  notificationTime,
} from './notificationService';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (data: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: '', data }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

it('lists the current user notifications and maps the read flag', async () => {
  const fetchMock = stubFetch([
    {
      id: 'a',
      kind: 'schedule',
      text: 'Đợt đã mở',
      from: 'Hệ thống',
      href: '/sv',
      createdAt: '2026-11-06T01:00:00.000Z',
      isRead: false,
    },
  ]);
  await expect(notificationService.list()).resolves.toEqual([
    {
      id: 'a',
      kind: 'schedule',
      text: 'Đợt đã mở',
      from: 'Hệ thống',
      href: '/sv',
      createdAt: '2026-11-06T01:00:00.000Z',
      unread: true,
    },
  ]);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/notifications/me');
});

it('posts the ids to mark as read', async () => {
  const fetchMock = stubFetch(2);
  await notificationService.markRead(['a', 'b']);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/notifications/read');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ ids: ['a', 'b'] });
});

it('groups by local day and formats the time like the bell design', () => {
  const now = new Date(2026, 10, 6, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  expect(notificationGroup(ago(60_000), now)).toBe('today');
  expect(notificationGroup(new Date(2026, 10, 5, 23).toISOString(), now)).toBe(
    'earlier',
  );
  expect(notificationTime(ago(10_000), now)).toBe('Vừa xong');
  expect(notificationTime(ago(15 * 60_000), now)).toBe('15 phút trước');
  expect(notificationTime(ago(2 * 3_600_000), now)).toBe('2 giờ trước');
  expect(notificationTime(new Date(2026, 10, 5, 20, 15).toISOString(), now)).toBe(
    'Hôm qua, 20:15',
  );
  expect(notificationTime(new Date(2026, 9, 12, 8).toISOString(), now)).toBe(
    '12/10',
  );
});
