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
  expect(dialog).toHaveTextContent('theo bộ lọc đang chọn ở bảng (8 đề tài)');
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
  expect(table.rows).toHaveLength(8);
  expect(table.rows.every((r) => r[6] === 'Đang thực hiện')).toBe(true);
  expect(
    screen.getByText(
      /Đã tải tệp Excel danh sách đề tài \(8 đề tài theo bộ lọc hiện tại/,
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
