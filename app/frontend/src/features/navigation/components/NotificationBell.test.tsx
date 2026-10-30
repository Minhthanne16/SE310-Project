import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createNotificationService } from '@/features/navigation/services/notificationService';
import { NotificationBell } from './NotificationBell';

afterEach(cleanup);

const renderBell = (audience: 'sv' | 'gv' | 'giaovu' = 'giaovu') =>
  render(
    <NotificationBell
      audience={audience}
      service={createNotificationService()}
    />,
  );

it('shows the unread count on the bell and opens the grouped list', async () => {
  renderBell();
  const bell = await screen.findByRole('button', {
    name: 'Thông báo, 3 chưa đọc',
  });
  expect(bell).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(bell);

  const popup = screen.getByRole('dialog', { name: 'Thông báo' });
  expect(popup).toHaveTextContent('HÔM NAY');
  expect(popup).toHaveTextContent('TRƯỚC ĐÓ');
  expect(
    screen.getByRole('link', { name: /Hạn giảng viên gửi đề tài kết thúc/ }),
  ).toHaveAttribute('href', '/giao-vu/de-tai');
});

it('filters unread and marks everything as read', async () => {
  renderBell();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Thông báo, 3 chưa đọc' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Chưa đọc (3)' }));
  expect(screen.getAllByRole('link')).toHaveLength(3);

  fireEvent.click(
    screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }),
  );
  expect(screen.getByText('Bạn đã đọc hết thông báo.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thông báo' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }),
  ).toBeDisabled();
});

it('marks one item as read when it is opened, and closes on Escape', async () => {
  renderBell('sv');
  fireEvent.click(
    await screen.findByRole('button', { name: 'Thông báo, 4 chưa đọc' }),
  );
  fireEvent.click(
    screen.getByRole('link', { name: /Giáo vụ đã phân công giảng viên/ }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Thông báo, 3 chưa đọc' }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Thông báo/ }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
