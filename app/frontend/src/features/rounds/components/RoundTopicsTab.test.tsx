import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetNavigation } from '@/test/navigationMock';
import { createRoundService } from '@/features/rounds/services/roundService';
import { createTopicService } from '@/features/topics/services/topicService';
import type { XlsxTable } from '@/lib/xlsx';
import type { Round } from '@/types/round';
import { RoundTopicsTab } from './RoundTopicsTab';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

beforeEach(() => resetNavigation('/giao-vu/dot/x'));
afterEach(cleanup);

const THS = 'r-ths-1-2026';
const VB1 = 'r-vb1-hk1';

// Giữ đợt trong state như RoundDetailPage để thấy kết quả công bố.
const Harness: React.FC<{
  initial: Round;
  props: Omit<React.ComponentProps<typeof RoundTopicsTab>, 'round'>;
}> = ({ initial, props }) => {
  const [round, setRound] = useState(initial);
  return <RoundTopicsTab round={round} {...props} onRoundChange={setRound} />;
};

const setup = async (
  id: string,
  today = '2026-10-26',
  limits?: { min: number; max: number },
) => {
  const roundService = createRoundService({ today });
  const topicService = createTopicService({
    today,
    roundService,
    loadLimits: limits,
  });
  const downloadFile =
    vi.fn<(name: string, table: XlsxTable) => Promise<void>>();
  downloadFile.mockResolvedValue(undefined);
  const onGoToConfig = vi.fn();
  render(
    <Harness
      initial={await roundService.get(id)}
      props={{ roundService, topicService, downloadFile, onGoToConfig }}
    />,
  );
  await screen.findByRole('table');
  return { roundService, downloadFile, onGoToConfig };
};

const publishButton = () =>
  screen.queryByRole('button', {
    name: /^(Đóng & công bố|Đã công bố) danh sách$/,
  });
const strip = () =>
  screen.getByRole('note', { name: 'Tình trạng công bố danh sách' });

it('shows the sending strip and publishes early with a non-blocking warning', async () => {
  // 10/08: giảng viên còn gửi đề tài đến 14/08; đăng ký đến 28/08.
  const { roundService } = await setup(THS, '2026-08-10');
  expect(strip()).toHaveTextContent(
    'Giảng viên đang gửi đề tài đến 23:59 ngày 14/08/2026.',
  );
  const button = publishButton()!;
  expect(button).toBeEnabled();

  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveAccessibleName('Đóng và công bố danh sách đề tài?');
  expect(dialog).toHaveTextContent(
    'Sinh viên còn 19 ngày để đăng ký, đến 23:59 ngày 28/08/2026',
  );
  expect(dialog).toHaveTextContent(
    'Chưa hết hạn giảng viên gửi đề tài (23:59 ngày 14/08/2026). Công bố bây giờ thì giảng viên không gửi thêm được.',
  );
  expect(dialog).toHaveTextContent('không hoàn tác được');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Để sau' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.click(button);
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Đóng và công bố',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(strip()).toHaveTextContent('Đã công bố danh sách đề tài.');
  expect(strip()).toHaveTextContent(
    'đăng ký được đến 23:59 ngày 28/08/2026; hết hạn, đăng ký tự đóng.',
  );
  expect(publishButton()).toHaveTextContent('Đã công bố danh sách');
  expect(publishButton()).toBeDisabled();
  expect((await roundService.get(THS)).topicsPublishedAt).not.toBeNull();
});

it('shows the waiting strip after the lecturer deadline, without the early warning', async () => {
  await setup(THS, '2026-08-20', { min: 3, max: 9 });
  expect(strip()).toHaveTextContent('Đã hết hạn giảng viên gửi đề tài');
  expect(strip()).toHaveTextContent(
    'để sinh viên đăng ký đến 23:59 ngày 28/08/2026.',
  );
  fireEvent.click(publishButton()!);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Sinh viên còn 9 ngày');
  expect(dialog).not.toHaveTextContent('Chưa hết hạn giảng viên gửi đề tài');
  // Cảnh báo số đề tài tối thiểu vẫn có, không chặn.
  expect(dialog).toHaveTextContent(
    /giảng viên chưa đạt số đề tài tối thiểu. Vẫn công bố được/,
  );
  expect(
    within(dialog).getByRole('button', { name: 'Đóng và công bố' }),
  ).toBeEnabled();
});

it('blocks publishing after the registration deadline and leads to the config tab', async () => {
  const { onGoToConfig } = await setup(THS);
  expect(strip()).toHaveTextContent('Chưa công bố và hạn đăng ký đã qua');
  expect(strip()).toHaveTextContent('(23:59 ngày 28/08/2026)');
  fireEvent.click(
    within(strip()).getByRole('button', { name: 'Mở tab Cấu hình' }),
  );
  expect(onGoToConfig).toHaveBeenCalledTimes(1);

  fireEvent.click(publishButton()!);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Hạn sinh viên đăng ký đã qua (23:59 ngày 28/08/2026)',
  );
  expect(dialog).not.toHaveTextContent('Sinh viên còn');
  expect(
    within(dialog).getByRole('button', { name: 'Đóng và công bố' }),
  ).toBeDisabled();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Mở tab Cấu hình' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(onGoToConfig).toHaveBeenCalledTimes(2);
});

it('shows the published strip with the auto-closed registration and the new statuses', async () => {
  await setup(VB1);
  expect(strip()).toHaveTextContent('Đã công bố danh sách ngày 21/09/2026.');
  expect(strip()).toHaveTextContent(
    'Đăng ký đã tự đóng lúc 23:59 ngày 02/10/2026',
  );
  expect(strip()).toHaveTextContent('chuyển sang Không có nhóm');
  expect(publishButton()).toBeDisabled();
  const filter = screen.getByRole('combobox', { name: 'Lọc theo trạng thái' });
  expect(
    within(filter).getByRole('option', { name: 'Không có nhóm (5)' }),
  ).toBeInTheDocument();
  fireEvent.change(filter, { target: { value: 'Không có nhóm' } });
  expect(screen.getAllByRole('row')).toHaveLength(6);
});

it('hides publishing for draft and finished rounds but keeps export', async () => {
  await setup('r-vb1-hk2-2025');
  expect(publishButton()).not.toBeInTheDocument();
  expect(
    screen.queryByRole('note', { name: 'Tình trạng công bố danh sách' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xuất danh sách' })).toBeEnabled();
  expect(screen.getByText('Không đủ điều kiện công bố')).toBeInTheDocument();
});

it('disables export when the round has no topics', async () => {
  const roundService = createRoundService();
  render(
    <RoundTopicsTab
      round={await roundService.get('r-vb2-hk2-nhap')}
      roundService={roundService}
      topicService={createTopicService({ roundService })}
    />,
  );
  await screen.findByText('Chưa có đề tài nào trong đợt');
  expect(screen.getByRole('button', { name: 'Xuất danh sách' })).toBeDisabled();
  expect(publishButton()).not.toBeInTheDocument();
});

it('shows the service error inside the publish dialog', async () => {
  const { roundService } = await setup(THS, '2026-08-20');
  vi.spyOn(roundService, 'markTopicsPublished').mockRejectedValue(
    new Error('Máy chủ từ chối.'),
  );
  fireEvent.click(publishButton()!);
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Đóng và công bố',
    }),
  );
  expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
  expect(screen.getByRole('dialog')).toHaveTextContent('Máy chủ từ chối.');
});

it('exports the topic list for the current filters as an .xlsx table', async () => {
  const { downloadFile } = await setup(VB1);
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }),
    {
      target: { value: 'Đang thực hiện' },
    },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveAccessibleName('Xuất danh sách ra Excel');
  expect(dialog).toHaveTextContent('theo bộ lọc đang chọn ở bảng (6 đề tài)');
  expect(
    within(dialog).getByRole('radio', { name: /Danh sách đề tài/ }),
  ).toBeChecked();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Tải tệp .xlsx' }),
  );

  await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1));
  const [name, table] = downloadFile.mock.calls[0];
  expect(name).toBe('danh-sach-de-tai-van-bang-1-hk1-2026-2027.xlsx');
  expect(table.header).toContain('Trạng thái');
  expect(table.rows).toHaveLength(6);
  expect(table.rows.every((r) => r[6] === 'Đang thực hiện')).toBe(true);
  expect(
    screen.getByText(
      /Đã tải tệp Excel danh sách đề tài \(6 đề tài theo bộ lọc hiện tại/,
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('exports one row per student of the round in the registration list', async () => {
  const { downloadFile } = await setup(VB1);
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(
    within(dialog).getByRole('radio', { name: /Danh sách đăng ký/ }),
  );
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Tải tệp .xlsx' }),
  );
  await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1));
  const [name, table] = downloadFile.mock.calls[0];
  expect(name).toBe('danh-sach-dang-ky-van-bang-1-hk1-2026-2027.xlsx');
  expect(table.header[table.header.length - 1]).toBe('Trạng thái đăng ký');
  expect(table.rows).toHaveLength(22);
  expect(table.rows.map((r) => r[6])).toContain('Chưa có đề tài');
  expect(
    await screen.findByText(
      /Đã tải tệp Excel danh sách đăng ký của đợt \(22 sinh viên/,
    ),
  ).toBeInTheDocument();
});

it('refuses to export an empty filtered list and reports download failures', async () => {
  const { downloadFile } = await setup(VB1);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm đề tài' }), {
    target: { value: 'không khớp gì cả' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Danh sách đang trống theo bộ lọc hiện tại');
  expect(
    within(dialog).getByRole('button', { name: 'Tải tệp .xlsx' }),
  ).toBeDisabled();
  // Danh sách đăng ký không phụ thuộc bộ lọc nên vẫn xuất được.
  downloadFile.mockRejectedValueOnce(new Error('Trình duyệt chặn tải tệp.'));
  fireEvent.click(
    within(dialog).getByRole('radio', { name: /Danh sách đăng ký/ }),
  );
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Tải tệp .xlsx' }),
  );
  expect(
    await within(dialog).findByText('Trình duyệt chặn tải tệp.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

// Dòng của bảng chứa mã đề tài.
const rowOf = (code: string) =>
  screen
    .getAllByRole('row')
    .find((r) => within(r).queryByText(new RegExp(`^${code} ·`)) !== null)!;
const hasCode = (code: string) =>
  screen
    .queryAllByRole('row')
    .some((r) => within(r).queryByText(new RegExp(`^${code} ·`)) !== null);
const expand = async (code: string) => {
  fireEvent.click(
    within(rowOf(code)).getByRole('button', { name: /Chi tiết/ }),
  );
  return screen.findByLabelText(`Chi tiết kết quả ${code}`);
};

it('hides rejected proposals after the registration deadline and keeps them in the note', async () => {
  // 26/10: đăng ký của VB1 đã đóng từ 02/10.
  await setup(VB1);
  expect(hasCode('VB1-12')).toBe(false);
  expect(screen.getByText(/17 \/ 17 đề tài/)).toBeInTheDocument();
  const filter = screen.getByRole('combobox', { name: 'Lọc theo trạng thái' });
  expect(
    within(filter).queryByRole('option', { name: /Bị từ chối/ }),
  ).not.toBeInTheDocument();
  // Đã đăng ký / Chờ GV duyệt hiển thị là Đang thực hiện.
  expect(
    within(filter).queryByRole('option', { name: /Chờ GV duyệt|Đã đăng ký/ }),
  ).not.toBeInTheDocument();
  expect(
    within(filter).getByRole('option', { name: 'Đang thực hiện (6)' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Đã gỡ 1 đề xuất bị từ chối .* vẫn xem được trong lịch sử đề tài/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Kết quả xác nhận và công bố theo cả nhóm đề tài\./),
  ).toBeInTheDocument();
});

it('still shows rejected proposals before the registration deadline', async () => {
  // 01/10: VB1 đã công bố, đăng ký còn đến 02/10.
  await setup(VB1, '2026-10-01');
  expect(hasCode('VB1-12')).toBe(true);
  expect(screen.getByText(/18 \/ 18 đề tài/)).toBeInTheDocument();
  expect(screen.queryByText(/Đã gỡ/)).not.toBeInTheDocument();
  expect(
    within(
      screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }),
    ).getByRole('option', { name: 'Bị từ chối (1)' }),
  ).toBeInTheDocument();
});

it('has no selection or action columns when no topic has results', async () => {
  await setup(THS, '2026-08-10');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('columnheader', { name: 'Thao tác' }),
  ).not.toBeInTheDocument();
});

it('selects rows, counts eligible topics per bulk action and reports mixed outcomes', async () => {
  await setup(VB1);
  expect(
    screen.queryByRole('toolbar', { name: 'Thao tác theo lô' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Chọn tất cả đề tài đang hiển thị' }),
  );
  const bar = screen.getByRole('toolbar', { name: 'Thao tác theo lô' });
  expect(bar).toHaveTextContent('Đã chọn 17 đề tài');
  expect(
    within(bar).getByRole('button', { name: 'Xác nhận (1)' }),
  ).toBeEnabled();
  expect(
    within(bar).getByRole('button', { name: 'Công bố (1)' }),
  ).toBeEnabled();
  expect(
    within(bar).getByRole('button', { name: 'Gửi nhắc lệch điểm (1)' }),
  ).toBeEnabled();

  fireEvent.click(within(bar).getByRole('button', { name: 'Xác nhận (1)' }));
  const report = await screen.findByRole('region', {
    name: 'Báo cáo thao tác theo lô',
  });
  expect(report).toHaveTextContent(
    'Xác nhận kết quả: 1 thành công, 16 bị bỏ qua',
  );
  expect(within(report).getAllByText('Thành công')).toHaveLength(1);
  expect(within(report).getAllByText('Bỏ qua')).toHaveLength(16);
  expect(report).toHaveTextContent('Còn cặp điểm lệch từ 2 điểm');
  expect(report).toHaveTextContent('Chưa đủ điểm');
  // Đề tài vừa xác nhận chuyển Đã xác nhận; lựa chọn được bỏ.
  expect(within(rowOf('VB1-08')).getByText('Đã xác nhận')).toBeInTheDocument();
  expect(
    screen.queryByRole('toolbar', { name: 'Thao tác theo lô' }),
  ).not.toBeInTheDocument();
});

it('never reports full success when a publish batch skips a topic', async () => {
  await setup(VB1);
  for (const code of ['VB1-15', 'VB1-16'])
    fireEvent.click(
      within(rowOf(code)).getByRole('checkbox', {
        name: `Chọn đề tài ${code}`,
      }),
    );
  const bar = screen.getByRole('toolbar', { name: 'Thao tác theo lô' });
  fireEvent.click(within(bar).getByRole('button', { name: 'Công bố (1)' }));
  const ask = within(bar).getByRole('group', {
    name: 'Xác nhận công bố theo lô',
  });
  expect(ask).toHaveTextContent('1 đề tài không hợp lệ sẽ bị bỏ qua');
  fireEvent.click(within(ask).getByRole('button', { name: 'Công bố' }));
  const report = await screen.findByRole('region', {
    name: 'Báo cáo thao tác theo lô',
  });
  expect(report).toHaveTextContent(
    'Công bố kết quả: 1 thành công, 1 bị bỏ qua',
  );
  expect(report).toHaveTextContent('Nhóm chưa chốt bản cuối');
  expect(within(rowOf('VB1-16')).getByText('Đã hoàn tất')).toBeInTheDocument();
  expect(within(rowOf('VB1-15')).getByText('Đã xác nhận')).toBeInTheDocument();
});

it('expands a deviating topic inline with red cells, blocked confirm and a composer', async () => {
  await setup(VB1);
  const toggle = within(rowOf('VB1-13')).getByRole('button', {
    name: /Chi tiết/,
  });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const panel = await expand('VB1-13');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle).toHaveTextContent('Thu gọn');

  const grid = within(panel).getByRole('table');
  for (const h of ['HD', 'PB', 'CT', 'TK', 'Điểm KL'])
    expect(
      within(grid).getByRole('columnheader', { name: h }),
    ).toBeInTheDocument();
  // CTHĐ 5,5 lệch CBHD 8 và CBPB 7,5; hai ô lệch có lớp đỏ.
  expect(grid.querySelectorAll('.rnd-score-dev')).toHaveLength(3);
  expect(
    within(panel).getByText('Cờ lệch điểm hội đồng (≥ 2 điểm)'),
  ).toBeVisible();
  expect(panel).toHaveTextContent('CTHĐ 5,5 – CBHD 8,0 (lệch 2,50)');
  expect(panel).toHaveTextContent('CBHD');
  expect(panel).toHaveTextContent('Khóa luận:');

  const confirm = within(panel).getByRole('button', {
    name: 'Xác nhận kết quả',
  });
  expect(confirm).toBeDisabled();
  expect(panel).toHaveTextContent(
    'Còn cặp điểm lệch từ 2 điểm. Giảng viên sửa phiếu hết lệch mới xác nhận được.',
  );

  fireEvent.click(within(panel).getByRole('button', { name: 'Gửi thông báo' }));
  const composer = within(panel).getByRole('group', {
    name: 'Soạn thông báo lệch điểm',
  });
  expect(composer).toHaveTextContent('Không gửi cho sinh viên');
  expect(composer).toHaveTextContent('Gửi đến 3 giảng viên trong cặp lệch');
  expect(
    (within(composer).getByRole('textbox') as HTMLTextAreaElement).value,
  ).toContain('VB1-13');
  fireEvent.click(within(composer).getByRole('button', { name: 'Gửi' }));
  expect(
    await within(panel).findByText(/Đã gửi nhắc cho 3 giảng viên/),
  ).toBeInTheDocument();

  fireEvent.click(toggle);
  expect(screen.queryByLabelText('Chi tiết kết quả VB1-13')).toBeNull();
});

it('confirms a graded group from its panel and shows missing scores for an incomplete one', async () => {
  await setup(VB1);
  const partial = await expand('VB1-06');
  expect(
    within(partial).getByRole('button', { name: 'Xác nhận kết quả' }),
  ).toBeDisabled();
  expect(partial).toHaveTextContent('Chưa đủ điểm. Thiếu CTHĐ, TKHĐ');
  expect(partial).toHaveTextContent('Không có cặp điểm lệch.');

  const ok = await expand('VB1-08');
  fireEvent.click(within(ok).getByRole('button', { name: 'Xác nhận kết quả' }));
  expect(
    await within(rowOf('VB1-08')).findByText('Đã xác nhận'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByLabelText('Chi tiết kết quả VB1-08')).getByRole(
      'button',
      { name: 'Hủy xác nhận' },
    ),
  ).toBeInTheDocument();
});

it('requires a reason to unconfirm and blocks publishing without a final lock', async () => {
  await setup(VB1);
  const panel = await expand('VB1-15');
  const publish = within(panel).getByRole('button', {
    name: 'Công bố kết quả',
  });
  expect(publish).toBeDisabled();
  expect(panel).toHaveTextContent(
    'Nhóm chưa chốt bản cuối và chưa hết hạn chốt.',
  );

  fireEvent.click(within(panel).getByRole('button', { name: 'Hủy xác nhận' }));
  const go = within(panel).getByRole('button', {
    name: 'Hủy xác nhận kết quả',
  });
  expect(go).toBeDisabled();
  fireEvent.change(within(panel).getByRole('textbox'), {
    target: { value: 'Sai điểm phản biện' },
  });
  expect(go).toBeEnabled();
  fireEvent.click(go);
  expect(
    await within(rowOf('VB1-15')).findByText('Đã cho điểm'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByLabelText('Chi tiết kết quả VB1-15')).getByRole(
      'button',
      { name: 'Xác nhận kết quả' },
    ),
  ).toBeEnabled();
});

it('asks for confirmation before publishing a locked group, then becomes read-only', async () => {
  await setup(VB1);
  const panel = await expand('VB1-16');
  fireEvent.click(
    within(panel).getByRole('button', { name: 'Công bố kết quả' }),
  );
  expect(
    within(panel).getByText('Công bố kết quả cho 1 sinh viên của nhóm?'),
  ).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: 'Công bố' }));
  expect(
    await within(rowOf('VB1-16')).findByText('Đã hoàn tất'),
  ).toBeInTheDocument();
  const after = screen.getByLabelText('Chi tiết kết quả VB1-16');
  expect(after).toHaveTextContent('Kết quả đã công bố cho cả nhóm');
  expect(
    within(after).queryByRole('button', { name: 'Hủy xác nhận' }),
  ).not.toBeInTheDocument();
  expect(after).toHaveTextContent('Chốt bản cuối');
});

it('keeps the finished round read-only without selection', async () => {
  await setup('r-vb1-hk2-2025');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  const panel = await expand('VB1-25-03');
  expect(panel).toHaveTextContent('Đợt đã kết thúc nên kết quả chỉ để xem.');
  expect(
    within(panel).queryByRole('button', { name: 'Xác nhận kết quả' }),
  ).not.toBeInTheDocument();
});
