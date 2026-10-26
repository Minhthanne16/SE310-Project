import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createRoundService } from '@/features/rounds/services/roundService';
import { RoundListPage } from './RoundListPage';

afterEach(cleanup);

const renderPage = async (service = createRoundService()) => {
  render(<RoundListPage roundService={service} />);
  await screen.findByText('Văn bằng 1 · HK1 2026–2027');
  return service;
};

const setStatus = (value: string) =>
  fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), {
    target: { value },
  });

it('defaults to running rounds and filters by status, program and name', async () => {
  await renderPage();
  expect(screen.getByLabelText('Lọc theo trạng thái')).toHaveValue(
    'Đang diễn ra',
  );
  expect(screen.getByText('Thạc sĩ · Đợt 1/2026')).toBeInTheDocument();
  expect(
    screen.queryByText('Văn bằng 2 · HK2 2026–2027'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'Mốc hiện tại' }),
  ).toBeInTheDocument();
  const row = screen.getByText('Thạc sĩ · Đợt 1/2026').closest('tr')!;
  expect(within(row).getByText('Báo cáo cuối kỳ')).toBeInTheDocument();

  setStatus('Nháp');
  expect(
    await screen.findByText('Văn bằng 2 · HK2 2026–2027'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('Văn bằng 1 · HK1 2026–2027'),
  ).not.toBeInTheDocument();

  setStatus('Tất cả');
  expect(
    await screen.findByText('Văn bằng 1 · HK2 2025–2026'),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Lọc theo chương trình'), {
    target: { value: 'Thạc sĩ' },
  });
  await waitFor(() =>
    expect(
      screen.queryByText('Văn bằng 1 · HK2 2025–2026'),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByText('Thạc sĩ · Đợt 1/2026')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Lọc theo chương trình'), {
    target: { value: '' },
  });
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), {
    target: { value: 'hk2 2025' },
  });
  expect(
    await screen.findByText('Văn bằng 1 · HK2 2025–2026'),
  ).toBeInTheDocument();
});

it('links each round to its detail page', async () => {
  await renderPage();
  expect(
    screen.getByRole('link', { name: 'Văn bằng 1 · HK1 2026–2027' }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1');
});

it('shows an empty state when nothing matches', async () => {
  await renderPage();
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), {
    target: { value: 'khong-co-dot-nao' },
  });
  expect(await screen.findByText('Không có đợt phù hợp')).toBeInTheDocument();
});

it('shows required-field errors in the create dialog', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt' }));
  const dialog = screen.getByRole('dialog', { name: 'Tạo đợt mới' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo đợt' }));
  expect(screen.getByText('Nhập tên đợt.')).toBeInTheDocument();
  expect(screen.getByText('Chọn chương trình.')).toBeInTheDocument();
  expect(screen.getByText('Nhập học kỳ hoặc khóa.')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Thiếu thông tin');
  expect(screen.getByLabelText(/Tên đợt/)).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

it('reports a duplicate round name', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt' }));
  fireEvent.change(screen.getByLabelText(/Tên đợt/), {
    target: { value: ' thạc sĩ · đợt 1/2026' },
  });
  fireEvent.change(screen.getByLabelText(/Chương trình/), {
    target: { value: 'Thạc sĩ' },
  });
  fireEvent.change(screen.getByLabelText(/Học kỳ/), {
    target: { value: 'Đợt 2/2026' },
  });
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo đợt' }),
  );
  expect(
    await screen.findByText('Tên đợt đã tồn tại. Đặt tên khác.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Trùng tên đợt');
  expect(
    screen.getByRole('dialog', { name: 'Tạo đợt mới' }),
  ).toBeInTheDocument();
});

it('creates a round copied from an old one and shows it as a draft', async () => {
  const service = await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt' }));
  fireEvent.change(screen.getByLabelText(/Tên đợt/), {
    target: { value: 'Văn bằng 1 · HK2 2026–2027' },
  });
  fireEvent.change(screen.getByLabelText(/Chương trình/), {
    target: { value: 'Văn bằng 1' },
  });
  fireEvent.change(screen.getByLabelText(/Học kỳ/), {
    target: { value: 'HK2 2026–2027' },
  });
  fireEvent.change(screen.getByLabelText('Sao chép từ đợt cũ'), {
    target: { value: 'r-vb1-hk1' },
  });
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo đợt' }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Tạo đợt mới' }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText('Lọc theo trạng thái')).toHaveValue('Nháp');
  const row = (
    await screen.findAllByText('Văn bằng 1 · HK2 2026–2027')
  )[0].closest('tr')!;
  expect(within(row).getByText('Nháp')).toBeInTheDocument();
  const created = (await service.list({ status: 'Nháp' })).find(
    (r) => r.name === 'Văn bằng 1 · HK2 2026–2027',
  )!;
  expect(created.lecturerIds).toHaveLength(3);
  expect(created.studentIds).toHaveLength(0);
});

it('opens a draft after a confirmation that warns about unfinished setup', async () => {
  const service = await renderPage();
  setStatus('Nháp');
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Mở đợt Văn bằng 2 · HK2 2026–2027',
    }),
  );
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('7 mốc chưa có ngày');
  expect(dialog).toHaveTextContent('Bạn vẫn có thể mở đợt');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Mở đợt' }));
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect((await service.get('r-vb2-hk2-nhap')).status).toBe('Đang diễn ra');
});

it('offers delete only for drafts and removes the round after confirming', async () => {
  const service = await renderPage();
  // Đợt đang diễn ra không có nút Xóa đợt.
  expect(
    screen.queryByRole('button', { name: /^Xóa đợt/ }),
  ).not.toBeInTheDocument();

  setStatus('Tất cả');
  await screen.findByText('Văn bằng 1 · HK2 2025–2026');
  expect(screen.getAllByRole('button', { name: /^Xóa đợt/ })).toHaveLength(1);

  fireEvent.click(
    screen.getByRole('button', { name: 'Xóa đợt Văn bằng 2 · HK2 2026–2027' }),
  );
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('không thể khôi phục');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa đợt' }));
  await waitFor(() =>
    expect(
      screen.queryByText('Văn bằng 2 · HK2 2026–2027'),
    ).not.toBeInTheDocument(),
  );
  expect(await service.list({ status: 'Tất cả' })).toHaveLength(4);
});
