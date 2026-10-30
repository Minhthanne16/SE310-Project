import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { act } from 'react';
import { afterEach, expect, it } from 'vitest';
import { createRoundService } from '@/features/rounds/services/roundService';
import { RoundListPage } from './RoundListPage';

afterEach(cleanup);

const roundLink = (name: string) => screen.findByRole('link', { name });

const renderPage = async (service = createRoundService()) => {
  render(<RoundListPage roundService={service} />);
  await roundLink('Văn bằng 1 · HK1 2026–2027');
  return service;
};

const setStatus = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

const rowOf = async (name: string) =>
  (await roundLink(name)).closest('li') as HTMLElement;

const statValue = (label: string) =>
  screen.getByText(label).closest('div')!.querySelector('dd')!.textContent;

it('shows stat tiles and defaults to running rounds, with a count on each status filter', async () => {
  await renderPage();
  expect(statValue('Đợt đang diễn ra')).toBe('3');
  expect(statValue('Giảng viên tham gia')).not.toBe('0');
  expect(screen.getByRole('button', { name: 'Đang diễn ra (3)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Nháp (1)' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Đã kết thúc (1)' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tất cả (5)' })).toBeInTheDocument();
  expect(screen.getByText('Tiến độ · mốc hiện tại')).toBeInTheDocument();
});

it('filters by status and program and shows the current milestone with a progress line', async () => {
  await renderPage();
  const ths = await rowOf('Thạc sĩ · Đợt 1/2026');
  expect(within(ths).getByText(/^Báo cáo cuối kỳ · hạn \d\d\/\d\d$/)).toBeInTheDocument();
  expect(within(ths).getByText(/^Tuần \d+\/\d+$/)).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Văn bằng 2 · HK2 2026–2027' }),
  ).not.toBeInTheDocument();

  setStatus('Nháp (1)');
  const draft = await rowOf('Văn bằng 2 · HK2 2026–2027');
  expect(within(draft).getByText(/^Chưa mở/)).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'Văn bằng 1 · HK1 2026–2027' }),
    ).not.toBeInTheDocument(),
  );

  setStatus('Tất cả (5)');
  await roundLink('Văn bằng 1 · HK2 2025–2026');
  fireEvent.change(screen.getByLabelText('Chương trình'), {
    target: { value: 'Thạc sĩ' },
  });
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'Văn bằng 1 · HK2 2025–2026' }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole('link', { name: 'Thạc sĩ · Đợt 1/2026' }),
  ).toBeInTheDocument();
  // Số đợt trên bộ lọc đổi theo chương trình đang chọn.
  expect(screen.getByRole('button', { name: 'Tất cả (1)' })).toBeInTheDocument();
});

it('links each round to its detail page', async () => {
  await renderPage();
  expect(
    await roundLink('Văn bằng 1 · HK1 2026–2027'),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1');
  expect(
    screen.getByRole('link', { name: 'Mở chi tiết Văn bằng 1 · HK1 2026–2027' }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1');
});

it('shows a message when nothing matches the filter', async () => {
  await renderPage();
  setStatus('Nháp (1)');
  await roundLink('Văn bằng 2 · HK2 2026–2027');
  fireEvent.change(screen.getByLabelText('Chương trình'), {
    target: { value: 'Thạc sĩ' },
  });
  expect(
    await screen.findByText('Không có đợt nào khớp bộ lọc.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Không có đợt')).toBeInTheDocument();
});

it('shows required-field errors in the create dialog', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt mới' }));
  const dialog = screen.getByRole('dialog', { name: 'Tạo đợt mới' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo đợt nháp' }));
  expect(within(dialog).getByText('Nhập tên đợt.')).toBeInTheDocument();
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Chưa tạo được đợt. Vui lòng bổ sung các mục được đánh dấu bên dưới.',
  );
  const name = within(dialog).getByLabelText(/Tên đợt/);
  expect(name).toHaveAttribute('aria-invalid', 'true');
  // Gõ lại thì lỗi ở ô biến mất.
  fireEvent.change(name, { target: { value: 'HK2 2026–2027' } });
  expect(within(dialog).queryByText('Nhập tên đợt.')).not.toBeInTheDocument();
});

it('reports a duplicate round name within the same program', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt mới' }));
  const dialog = screen.getByRole('dialog', { name: 'Tạo đợt mới' });
  fireEvent.change(within(dialog).getByLabelText(/Chương trình/), {
    target: { value: 'Thạc sĩ' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Tên đợt/), {
    target: { value: ' đợt 1/2026' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo đợt nháp' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Chưa tạo được đợt. Tên đợt bị trùng với một đợt đã có.',
  );
  expect(
    within(dialog).getByText(
      'Chương trình Thạc sĩ đã có đợt “Đợt 1/2026” (Đang diễn ra). Đặt tên khác để phân biệt.',
    ),
  ).toBeInTheDocument();

  // Cùng tên ở chương trình khác thì hợp lệ.
  fireEvent.change(within(dialog).getByLabelText(/Chương trình/), {
    target: { value: 'Văn bằng 2' },
  });
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
});

it('creates a round copied from an old one and shows it as a draft', async () => {
  const service = await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt mới' }));
  const dialog = screen.getByRole('dialog', { name: 'Tạo đợt mới' });
  fireEvent.change(within(dialog).getByLabelText(/Tên đợt/), {
    target: { value: 'HK2 2026–2027' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Chương trình/), {
    target: { value: 'Văn bằng 1' },
  });
  fireEvent.change(within(dialog).getByLabelText('Sao chép cấu hình từ'), {
    target: { value: 'r-vb1-hk1' },
  });
  expect(
    screen.getByRole('dialog', { name: 'Tạo đợt từ đợt cũ' }),
  ).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo đợt nháp' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('button', { name: /^Nháp \(2\)$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const row = await rowOf('Văn bằng 1 · HK2 2026–2027');
  expect(within(row).getByText('Nháp')).toBeInTheDocument();
  const created = (await service.list({ status: 'Nháp' })).find(
    (r) => r.name === 'Văn bằng 1 · HK2 2026–2027',
  )!;
  expect(created.periodLabel).toBe('HK2 2026–2027');
  expect(created.lecturerIds).toHaveLength(3);
  expect(created.studentIds).toHaveLength(0);
});

it('opens the copy dialog with a finished round preselected', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Sao chép từ đợt cũ' }));
  const dialog = screen.getByRole('dialog', { name: 'Tạo đợt từ đợt cũ' });
  expect(within(dialog).getByLabelText('Sao chép cấu hình từ')).toHaveValue(
    'r-vb1-hk2-2025',
  );
  expect(dialog).toHaveTextContent('Không sao chép ngày và danh sách sinh viên');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('opens a draft after a confirmation that warns about unfinished setup', async () => {
  const service = await renderPage();
  setStatus('Nháp (1)');
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Mở đợt Văn bằng 2 · HK2 2026–2027',
    }),
  );
  const dialog = screen.getByRole('dialog', {
    name: 'Mở đợt Văn bằng 2 · HK2 2026–2027?',
  });
  expect(dialog).toHaveTextContent('7 mốc chưa có ngày');
  expect(dialog).toHaveTextContent('Vẫn mở được, có thể bổ sung sau');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Mở đợt' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect((await service.get('r-vb2-hk2-nhap')).status).toBe('Đang diễn ra');
  expect(
    screen.getByRole('button', { name: /^Đang diễn ra \(4\)$/ }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('offers delete only for drafts and removes the round after confirming', async () => {
  const service = await renderPage();
  // Đợt đang diễn ra không có nút Xóa đợt.
  expect(
    screen.queryByRole('button', { name: /^Xóa đợt/ }),
  ).not.toBeInTheDocument();

  setStatus('Tất cả (5)');
  await roundLink('Văn bằng 1 · HK2 2025–2026');
  expect(screen.getAllByRole('button', { name: /^Xóa đợt/ })).toHaveLength(1);

  fireEvent.click(
    screen.getByRole('button', { name: 'Xóa đợt Văn bằng 2 · HK2 2026–2027' }),
  );
  const dialog = screen.getByRole('alertdialog', {
    name: 'Xóa đợt Văn bằng 2 · HK2 2026–2027?',
  });
  expect(dialog).toHaveTextContent('không khôi phục được');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa đợt' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'Văn bằng 2 · HK2 2026–2027' }),
    ).not.toBeInTheDocument(),
  );
  expect(await service.list({ status: 'Tất cả' })).toHaveLength(4);
});

it('pages through more rounds than fit on a page', async () => {
  const base = (await createRoundService().list({ status: 'Đang diễn ra' }))[0];
  const many = Array.from({ length: 25 }, (_, i) => ({
    ...base,
    id: `x${i}`,
    name: `Đợt số ${String(i).padStart(2, '0')}`,
  }));
  render(<RoundListPage roundService={createRoundService({ rounds: many })} />);
  await roundLink('Đợt số 00');
  expect(screen.getByText('Hiển thị 1–6 trên 25 đợt')).toBeInTheDocument();
  expect(screen.getByText('Trang 1 / 5')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Đợt số 05' })).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Đợt số 06' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByRole('link', { name: 'Đợt số 06' })).toBeInTheDocument();
  expect(screen.getByText('Hiển thị 7–12 trên 25 đợt')).toBeInTheDocument();
  for (let i = 0; i < 3; i += 1)
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByRole('link', { name: 'Đợt số 24' })).toBeInTheDocument();
  expect(screen.getByText('Hiển thị 25–25 trên 25 đợt')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
});

it('keeps the list visible while it reloads and ignores a stale response', async () => {
  const service = createRoundService();
  const real = service.list.bind(service);
  let releaseFirst: () => void = () => {};
  let calls = 0;
  service.list = (filters) => {
    calls += 1;
    // Hai lần gọi đầu (lần tải đầu) trả ngay; lần lọc "Nháp" đầu tiên bị giữ lại.
    if (calls === 3 && filters?.status === 'Nháp')
      return new Promise((resolve) => {
        releaseFirst = () => resolve(real(filters));
      });
    return real(filters);
  };
  render(<RoundListPage roundService={service} />);
  await roundLink('Văn bằng 1 · HK1 2026–2027');

  setStatus('Nháp (1)');
  // Danh sách cũ vẫn hiện trong lúc chờ, không có "Đang tải" toàn trang.
  expect(
    screen.getByRole('link', { name: 'Văn bằng 1 · HK1 2026–2027' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('Đang tải danh sách đợt...'),
  ).not.toBeInTheDocument();
  setStatus('Đã kết thúc (1)');
  expect(
    await roundLink('Văn bằng 1 · HK2 2025–2026'),
  ).toBeInTheDocument();
  // Phản hồi "Nháp" đến muộn không được ghi đè kết quả mới.
  await act(async () => releaseFirst());
  expect(
    screen.getByRole('link', { name: 'Văn bằng 1 · HK2 2025–2026' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Văn bằng 2 · HK2 2026–2027' }),
  ).not.toBeInTheDocument();
});
