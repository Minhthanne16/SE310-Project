import { describe, expect, it } from 'vitest';
import { seedParticipants } from '@/features/rounds/services/roundSeed';
import { seedTopics } from '@/features/topics/services/topicSeed';
import {
  REGISTRATION_HEADER,
  TOPIC_LIST_HEADER,
  buildRegistrationTable,
  buildTopicListTable,
  exportFileName,
  registrationStatusOf,
} from '@/features/topics/topicExport';
import type { Topic } from '@/types/topic';

const topics = seedTopics();
const find = (code: string): Topic => {
  const found = topics.find((t) => t.code === code);
  if (!found) throw new Error(code);
  return found;
};
const vb1Topics = topics.filter((t) => t.roundId === 'r-vb1-hk1');
const students = seedParticipants().student;

describe('buildTopicListTable', () => {
  it('has the agreed columns including status and thesis progress', () => {
    expect(TOPIC_LIST_HEADER).toEqual([
      'Mã',
      'Tên đề tài',
      'Lĩnh vực',
      'GV hướng dẫn',
      'Nhóm',
      'Nguồn',
      'Trạng thái',
      'Tiến độ khóa luận',
    ]);
    const table = buildTopicListTable([find('VB1-03'), find('VB1-01')]);
    expect(table.header).toBe(TOPIC_LIST_HEADER);
    // Sắp theo mã.
    expect(table.rows.map((r) => r[0])).toEqual(['VB1-01', 'VB1-03']);
    expect(table.rows[1]).toEqual([
      'VB1-03',
      'Nền tảng đặt sân thể thao trực tuyến',
      'Phát triển phần mềm',
      'Nguyễn Thị Hương',
      '22520001 Nguyễn Văn An; 22520002 Lê Thị Bình',
      'GV công bố',
      'Đã đăng ký',
      'Chờ nộp đề cương',
    ]);
    expect(table.rows[0][6]).toBe('Không có nhóm');
    expect(table.rows[0][4]).toBe('');
  });

  it('keeps only the rows it is given (filters are applied by the caller)', () => {
    expect(buildTopicListTable([]).rows).toEqual([]);
    expect(buildTopicListTable(vb1Topics).rows).toHaveLength(vb1Topics.length);
  });
});

describe('buildRegistrationTable', () => {
  const roundStudents = students.filter((s) =>
    ['22520001', '22520016', '22520019', '22520021', '22520020'].includes(
      s.code,
    ),
  );
  const table = buildRegistrationTable(roundStudents, vb1Topics);
  const byCode = Object.fromEntries(table.rows.map((r) => [r[0], r]));

  it('lists one row per student with the registration status column', () => {
    expect(table.header).toBe(REGISTRATION_HEADER);
    expect(table.rows).toHaveLength(5);
    expect(table.rows.map((r) => r[0])).toEqual(
      table.rows.map((r) => r[0]).toSorted(),
    );
    expect(byCode['22520001']).toEqual([
      '22520001',
      'Nguyễn Văn An',
      'KTPM2022',
      'VB1-03',
      'Nền tảng đặt sân thể thao trực tuyến',
      'Nguyễn Thị Hương',
      'Đã đăng ký',
    ]);
  });

  it('derives Chờ GV duyệt, Bị từ chối and Đã đăng ký from the topic', () => {
    expect(registrationStatusOf(find('VB1-11'))).toBe('Chờ GV duyệt');
    expect(registrationStatusOf(find('VB1-12'))).toBe('Bị từ chối');
    expect(registrationStatusOf(find('VB1-04'))).toBe('Đã đăng ký');
    expect(byCode['22520019'][6]).toBe('Chờ GV duyệt');
    expect(byCode['22520021'][6]).toBe('Bị từ chối');
    expect(byCode['22520016'][6]).toBe('Đã đăng ký');
  });

  it('marks students outside every group as Chưa có đề tài with empty topic columns', () => {
    const none = buildRegistrationTable(
      students.filter((s) => s.code === '22520030'),
      vb1Topics.filter((t) => t.code !== 'VB1-18'),
    );
    expect(none.rows[0]).toEqual([
      '22520030',
      'Cao Thị Hồng',
      'KTPM2022',
      '',
      '',
      '',
      'Chưa có đề tài',
    ]);
  });

  it('prefers the best status when a student is in several topics', () => {
    const rejected = { ...find('VB1-12') };
    const accepted = find('VB1-16');
    const member = accepted.group[0];
    rejected.group = [{ ...rejected.group[0], ...member }];
    const result = buildRegistrationTable(
      students.filter((s) => s.id === member.id),
      [rejected, accepted],
    );
    expect(result.rows[0][6]).toBe('Đã đăng ký');
    expect(result.rows[0][3]).toBe(accepted.code);
  });
});

it('names the file after the export kind and the slugified round name', () => {
  expect(exportFileName('topics', 'Văn bằng 1 · HK1 2026–2027')).toBe(
    'danh-sach-de-tai-van-bang-1-hk1-2026-2027.xlsx',
  );
  expect(exportFileName('registrations', 'Đợt Đặc biệt / 1')).toBe(
    'danh-sach-dang-ky-dot-dac-biet-1.xlsx',
  );
  expect(exportFileName('topics', '···')).toBe('danh-sach-de-tai.xlsx');
});
