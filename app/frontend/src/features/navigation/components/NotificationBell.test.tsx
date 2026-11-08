import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  BellNotification,
  NotificationService,
} from '@/features/navigation/services/notificationService';
import { NotificationBell } from './NotificationBell';

afterEach(cleanup);

const row = (
  id: string,
  text: string,
  overrides: Partial<BellNotification> = {},
): BellNotification => ({
  id,
  kind: 'schedule',
  text,
  from: 'Hệ thống',
  href: '/giao-vu/dot',
  createdAt: new Date().toISOString(),
  unread: true,
  ...overrides,
});

const fakeService = (
  items: BellNotification[],
  overrides: Partial<NotificationService> = {},
): NotificationService => ({
  list: vi.fn().mockResolvedValue(items),
  markRead: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const earlier = new Date(Date.now() - 5 * 86_400_000).toISOString();

const sample = () => [
  row('a', 'Đợt mới đã mở'),
  row('b', 'Đã có lịch bảo vệ'),
  row('c', 'Thông báo cũ', { createdAt: earlier, unread: false }),
];

it('shows the unread count and opens the list grouped by day', async () => {
  render(<NotificationBell service={fakeService(sample())} />);
  const bell = await screen.findByRole('button', {
    name: 'Thông báo, 2 chưa đọc',
  });
  expect(bell).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(bell);

  const popup = screen.getByRole('dialog', { name: 'Thông báo' });
  expect(popup).toHaveTextContent('HÔM NAY');
  expect(popup).toHaveTextContent('TRƯỚC ĐÓ');
  expect(popup).not.toHaveTextContent('Dữ liệu minh họa');
  expect(screen.getByRole('link', { name: /Đợt mới đã mở/ })).toHaveAttribute(
    'href',
    '/giao-vu/dot',
  );
});

it('filters unread and marks everything as read through the service', async () => {
  const service = fakeService(sample());
  render(<NotificationBell service={service} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Chưa đọc (2)' }));
  expect(screen.getAllByRole('link')).toHaveLength(2);

  fireEvent.click(
    screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }),
  );
  expect(service.markRead).toHaveBeenCalledWith(['a', 'b']);
  expect(screen.getByText('Bạn đã đọc hết thông báo.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thông báo' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }),
  ).toBeDisabled();
});

it('marks one item as read when it is opened, and closes on Escape', async () => {
  // jsdom không điều hướng được: chặn mặc định của liên kết cho đỡ nhiễu.
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener('click', stop);
  const service = fakeService(sample());
  render(<NotificationBell service={service} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' }),
  );
  fireEvent.click(await screen.findByRole('link', { name: /Đợt mới đã mở/ }));
  expect(service.markRead).toHaveBeenCalledWith(['a']);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Thông báo/ }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  document.removeEventListener('click', stop);
});

it('restores the unread state and reports it when saving fails', async () => {
  const service = fakeService(sample(), {
    markRead: vi.fn().mockRejectedValue(new Error('down')),
  });
  render(<NotificationBell service={service} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Đánh dấu tất cả đã đọc' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Chưa đánh dấu đã đọc được.',
  );
  expect(
    screen.getByRole('button', { name: 'Thông báo, 2 chưa đọc' }),
  ).toBeInTheDocument();
});

it('shows an empty state for a user without notifications', async () => {
  const service = fakeService([]);
  render(<NotificationBell service={service} />);
  await waitFor(() => expect(service.list).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
  expect(await screen.findByText('Chưa có thông báo nào.')).toBeInTheDocument();
});

it('reports a load failure and retries on request', async () => {
  const list = vi
    .fn()
    .mockRejectedValueOnce(new Error('down'))
    .mockRejectedValueOnce(new Error('down'))
    .mockResolvedValue(sample());
  render(<NotificationBell service={fakeService([], { list })} />);
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Không tải được thông báo.',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(
    await screen.findByRole('link', { name: /Đợt mới đã mở/ }),
  ).toBeInTheDocument();
});
