import { expect, it } from 'vitest';
import {
  LECTURER_LOAD_MAX,
  LECTURER_LOAD_MIN,
  buildTopicsCsv,
  countsTowardLoad,
  formatScore,
  lecturerLoads,
  loadLevel,
  thesisProgress,
  totalScore,
} from '@/features/topics/topicUtils';
import { seedTopics } from '@/features/topics/services/topicSeed';
import type { Topic } from '@/types/topic';

const find = (code: string): Topic =>
  seedTopics().find((t) => t.code === code)!;

it('computes the weighted total with two-decimal rounding', () => {
  // (8 + 8,5 + 18 + 17) / 6 = 8,5833...
  expect(totalScore({ CTHĐ: 8, TKHĐ: 8.5, CBHD: 9, CBPB: 8.5 })).toBe(8.58);
  // 50 / 6 = 8,3333...
  expect(totalScore({ CTHĐ: 7, TKHĐ: 8, CBHD: 8.5, CBPB: 9 })).toBe(8.33);
  // 11 / 6 = 1,8333...
  expect(totalScore({ CTHĐ: 0, TKHĐ: 1, CBHD: 2, CBPB: 3 })).toBe(1.83);
  // Hòa ở nửa trăm: (705 + 800 + 1700 + 1700) / 6 = 817,5 → 8,18.
  expect(totalScore({ CTHĐ: 7.05, TKHĐ: 8, CBHD: 8.5, CBPB: 8.5 })).toBe(8.18);
  expect(totalScore({ CTHĐ: 5, TKHĐ: 5, CBHD: 5, CBPB: 5 })).toBe(5);
  expect(totalScore({ CTHĐ: 10, TKHĐ: 10, CBHD: 10, CBPB: 10 })).toBe(10);
});

it('returns null unless all four scores are present', () => {
  expect(totalScore({ CTHĐ: null, TKHĐ: 8, CBHD: 9, CBPB: 8 })).toBeNull();
  expect(totalScore({ CTHĐ: 8, TKHĐ: 8, CBHD: 9, CBPB: null })).toBeNull();
  // 0 là điểm hợp lệ, không phải thiếu.
  expect(totalScore({ CTHĐ: 0, TKHĐ: 0, CBHD: 0, CBPB: 0 })).toBe(0);
});

it('formats scores with a decimal comma', () => {
  expect(formatScore(8.5)).toBe('8,50');
  expect(formatScore(null)).toBe('—');
});

it('classifies the lecturer load against the provisional min and max', () => {
  expect(loadLevel(LECTURER_LOAD_MAX + 1)).toBe('over');
  expect(loadLevel(LECTURER_LOAD_MAX)).toBe('ok');
  expect(loadLevel(LECTURER_LOAD_MIN)).toBe('ok');
  expect(loadLevel(LECTURER_LOAD_MIN - 1)).toBe('below');
});

it('counts GV topics and accepted SV proposals only', () => {
  expect(countsTowardLoad(find('VB1-01'))).toBe(true);
  expect(countsTowardLoad(find('VB1-07'))).toBe(true); // SV đề xuất, đã đăng ký
  expect(countsTowardLoad(find('VB1-11'))).toBe(false); // Chờ GV duyệt
  expect(countsTowardLoad(find('VB1-12'))).toBe(false); // Bị từ chối
  const loads = lecturerLoads(
    seedTopics().filter((t) => t.roundId === 'r-vb1-hk1'),
    ['CB101', 'CB102', 'CB103'],
  );
  expect(loads.CB101).toMatchObject({ count: 8, level: 'over' });
  expect(loads.CB102).toMatchObject({ count: 6, level: 'ok' });
  expect(loads.CB103).toMatchObject({ count: 2, level: 'ok' });
});

it('describes thesis progress', () => {
  expect(thesisProgress(find('VB1-01'))).toBe('—');
  expect(thesisProgress(find('VB1-03'))).toBe('Chờ nộp đề cương');
  expect(thesisProgress(find('VB1-04'))).toBe('Giữa kỳ · v2');
  expect(thesisProgress(find('VB1-25-01'))).toBe('Bản khóa luận · v4');
});

it('builds CSV with header, CRLF and formula-injection protection', () => {
  const topic = {
    ...find('VB1-03'),
    title: '=HYPERLINK("http://x")',
    field: 'Có, dấu phẩy',
  };
  const lines = buildTopicsCsv([topic]).split('\r\n');
  expect(lines[0]).toBe(
    'Mã,Tên đề tài,Lĩnh vực,GVHD,Nhóm,Nguồn,Trạng thái,Khóa luận',
  );
  expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
  expect(lines[1]).toContain('"Có, dấu phẩy"');
  expect(lines[1]).toContain('22520001 Nguyễn Văn An; 22520002 Lê Thị Bình');
  expect(lines[2]).toBe('');
  expect(buildTopicsCsv([])).toBe(
    'Mã,Tên đề tài,Lĩnh vực,GVHD,Nhóm,Nguồn,Trạng thái,Khóa luận\r\n',
  );
});
