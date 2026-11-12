import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  TopicRuleError,
  type LecturerTopicService,
} from '@/features/topics/services/topicApiService';
import type { Round } from '@/types/round';
import type { LecturerTopicList, TopicDto } from '@/types/topic';
import { LecturerTopicsPage } from './LecturerTopicsPage';

afterEach(cleanup);

const round = (overrides: Partial<Round> = {}): Round =>
  ({
    id: 'r1',
    name: 'Văn bằng 1 · HK1',
    status: 'Đang diễn ra',
    topicsPublishedAt: null,
    ...overrides,
  }) as Round;

const topic = (overrides: Partial<TopicDto> = {}): TopicDto => ({
  id: 't1',
  roundId: 'r1',
  code: 'DT-001',
  title: 'Hệ thống gợi ý khóa học',
  field: 'Trí tuệ nhân tạo',
  description: 'Gợi ý theo lịch sử học tập',
  requirements: 'Biết Python',
  supervisor: { id: 'gv1', code: 'GV0001', name: 'Trần Thị Bình' },
  source: 'GV công bố',
  status: 'Chưa đăng ký',
  createdAt: '2026-11-07T08:00:00Z',
  updatedAt: null,
  canEdit: 'all',
  canDelete: true,
  group: [],
  outlineApprovedAt: null,
  ...overrides,
});

const list = (
  overrides: Partial<LecturerTopicList['round']> = {},
  items: TopicDto[] = [topic()],
  load: Partial<LecturerTopicList['load']> = {},
): LecturerTopicList => ({
  round: {
    roundId: 'r1',
    roundName: 'Văn bằng 1 · HK1',
    roundStatus: 'Đang diễn ra',
    topicsPublishedAt: null,
    submissionStart: '2026-11-01',
    submissionEnd: '2026-11-10',
    registrationEnd: '2026-11-20',
    canSubmit: true,
    submitBlockedReason: null,
    ...overrides,
  },
  items,
  load: {
    lecturerId: 'gv1',
    count: items.length,
    min: 0,
    max: 0,
    level: 'ok',
    ...load,
  },
});

const fakeService = (
  overrides: Partial<LecturerTopicService> = {},
): LecturerTopicService => ({
  listRounds: vi.fn().mockResolvedValue([round()]),
  listMine: vi.fn().mockResolvedValue(list()),
  create: vi.fn().mockResolvedValue(topic()),
  update: vi.fn().mockResolvedValue(topic()),
  remove: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: false }), {
    target: { value },
  });

it('lists my topics with the submission phase and adds a topic after checking required fields', async () => {
  const service = fakeService();
  render(<LecturerTopicsPage service={service} />);

  expect(
    await screen.findByText('Hệ thống gợi ý khóa học'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Đang gửi đề tài \(hạn 10\/11\/2026\)/),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Thêm đề tài' }));
  const dialog = screen.getByRole('dialog', { name: 'Thêm đề tài' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi đề tài' }));
  expect(within(dialog).getByText('Nhập tên đề tài.')).toBeInTheDocument();
  expect(within(dialog).getByText('Chọn lĩnh vực.')).toBeInTheDocument();
  expect(within(dialog).getByText('Nhập mô tả đề tài.')).toBeInTheDocument();
  expect(service.create).not.toHaveBeenCalled();

  type('Tên đề tài', 'Phân tích log');
  type('Lĩnh vực', 'Khoa học dữ liệu');
  type('Mô tả', 'Phân tích log hệ thống');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi đề tài' }));

  expect(await screen.findByText('Đã gửi đề tài.')).toBeInTheDocument();
  expect(service.create).toHaveBeenCalledWith('r1', {
    title: 'Phân tích log',
    field: 'Khoa học dữ liệu',
    description: 'Phân tích log hệ thống',
    requirements: '',
  });
  expect(service.listMine).toHaveBeenCalledTimes(2);
});

it('after publishing locks adding and deleting and only lets the content change', async () => {
  const service = fakeService({
    listRounds: vi
      .fn()
      .mockResolvedValue([
        round({ topicsPublishedAt: '2026-11-11T02:00:00Z' }),
      ]),
    listMine: vi.fn().mockResolvedValue(
      list(
        {
          topicsPublishedAt: '2026-11-11T02:00:00Z',
          canSubmit: false,
          submitBlockedReason:
            'Danh sách đề tài đã công bố nên không thêm đề tài mới.',
        },
        [topic({ canEdit: 'content', canDelete: false })],
      ),
    ),
  });
  render(<LecturerTopicsPage service={service} />);

  await screen.findByText('Hệ thống gợi ý khóa học');
  expect(screen.getByRole('button', { name: 'Thêm đề tài' })).toBeDisabled();
  expect(
    screen.getByText('Danh sách đề tài đã công bố nên không thêm đề tài mới.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Xóa Hệ thống gợi ý khóa học' }),
  ).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: 'Sửa Hệ thống gợi ý khóa học' }),
  );
  const dialog = screen.getByRole('dialog');
  expect(
    within(dialog).getByLabelText('Tên đề tài', { exact: false }),
  ).toBeDisabled();
  expect(
    within(dialog).getByLabelText('Lĩnh vực', { exact: false }),
  ).toBeDisabled();
  type('Mô tả', 'Mô tả mới');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));

  expect(await screen.findByText('Đã lưu đề tài.')).toBeInTheDocument();
  expect(service.update).toHaveBeenCalledWith(
    't1',
    expect.objectContaining({ description: 'Mô tả mới' }),
  );
});

it('hides edit for a topic that already has a group', async () => {
  render(
    <LecturerTopicsPage
      service={fakeService({
        listMine: vi.fn().mockResolvedValue(
          list({ canSubmit: false }, [
            topic({
              status: 'Đã đăng ký',
              canEdit: 'none',
              canDelete: false,
            }),
          ]),
        ),
      })}
    />,
  );
  await screen.findByText('Hệ thống gợi ý khóa học');
  expect(
    screen.queryByRole('button', { name: /^Sửa/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Đã đăng ký')).toBeInTheDocument();
});

it('warns without blocking when the lecturer is over the maximum load', async () => {
  render(
    <LecturerTopicsPage
      service={fakeService({
        listMine: vi
          .fn()
          .mockResolvedValue(
            list({}, [topic()], { count: 4, max: 3, level: 'over' }),
          ),
      })}
    />,
  );
  expect(
    await screen.findByText(/Bạn đang có 4 đề tài, vượt mức tối đa 3/),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thêm đề tài' })).toBeEnabled();
});

it('confirms before deleting and shows the server rule error in the dialog', async () => {
  const service = fakeService({
    remove: vi
      .fn()
      .mockRejectedValueOnce(
        new TopicRuleError(
          'Danh sách đề tài đã công bố nên không xóa được đề tài.',
        ),
      )
      .mockResolvedValueOnce(undefined),
  });
  render(<LecturerTopicsPage service={service} />);
  await screen.findByText('Hệ thống gợi ý khóa học');

  fireEvent.click(
    screen.getByRole('button', { name: 'Xóa Hệ thống gợi ý khóa học' }),
  );
  const dialog = screen.getByRole('alertdialog', { name: 'Xóa đề tài?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa đề tài' }));
  expect(
    await within(dialog).findByText(
      'Danh sách đề tài đã công bố nên không xóa được đề tài.',
    ),
  ).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa đề tài' }));
  expect(await screen.findByText('Đã xóa đề tài.')).toBeInTheDocument();
});

it('keeps showing the topics when the same round is picked again', async () => {
  render(<LecturerTopicsPage service={fakeService()} />);
  await screen.findByText('Hệ thống gợi ý khóa học');

  fireEvent.change(screen.getByLabelText('Đợt'), { target: { value: 'r1' } });

  expect(screen.getByText('Hệ thống gợi ý khóa học')).toBeInTheDocument();
  expect(screen.queryByText('Đang tải đề tài...')).not.toBeInTheDocument();
});

it('explains when the lecturer is not in any opened round', async () => {
  render(
    <LecturerTopicsPage
      service={fakeService({ listRounds: vi.fn().mockResolvedValue([]) })}
    />,
  );
  expect(
    await screen.findByRole('heading', { name: 'Chưa có đợt' }),
  ).toBeInTheDocument();
});
