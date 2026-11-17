import { describe, expect, it } from 'vitest';
import { seedParticipants } from '@/features/rounds/services/roundSeed';
import { seedTopics } from '@/features/topics/services/topicSeed';
import type { TopicDto } from '@/types/topic';
import {
  filterStatistics,
  registrationStatisticsTable,
  topicStatisticsTable,
  type RoundStatistics,
  type TopicStatisticsRow,
} from './statisticsData';

const topics = seedTopics();
const row = (code: string): TopicStatisticsRow => {
  const topic = topics.find((candidate) => candidate.code === code);
  if (!topic) throw new Error(code);
  return {
    topic: topic as unknown as TopicDto,
    stages: [topic.group.length > 0, false, false, false, false, false],
    progress: 'Chờ nộp đề cương',
  };
};

describe('statistics exports', () => {
  it('filters the same detailed topics that Excel exports', () => {
    const rows = [row('VB1-01'), row('VB1-03')];
    const selected = filterStatistics(rows, {
      status: 'Đã đăng ký',
      search: 'thể thao',
      supervisorId: '',
    });
    expect(selected).toHaveLength(1);
    expect(selected[0].topic.code).toBe('VB1-03');
    expect(topicStatisticsTable(selected).rows).toEqual([
      [
        'VB1-03',
        'Nền tảng đặt sân thể thao trực tuyến',
        'Phát triển phần mềm',
        'Nguyễn Thị Hương',
        '22520001 Nguyễn Văn An; 22520002 Lê Thị Bình',
        'GV công bố',
        'Đã đăng ký',
        'Chờ nộp đề cương',
      ],
    ]);
    expect(
      filterStatistics(rows, {
        status: '',
        search: 'không tồn tại',
        supervisorId: '',
      }),
    ).toEqual([]);
  });

  it('exports two group members and an unassigned student as three registration rows', () => {
    const group = row('VB1-03');
    const students = seedParticipants().student.filter(
      (student) =>
        group.topic.group.some((member) => member.id === student.id) ||
        student.code === '22520030',
    );
    const data: RoundStatistics = {
      roundId: 'r-vb1-hk1',
      roundName: 'Văn bằng 1',
      roundStatus: 'Đang diễn ra',
      snapshotAt: new Date().toISOString(),
      loads: [],
      gradesAvailable: false,
      items: [group],
      students,
    };
    const table = registrationStatisticsTable(data);
    expect(table.rows).toHaveLength(3);
    expect(table.rows.filter((value) => value[3] === 'VB1-03')).toHaveLength(2);
    expect(table.rows.find((value) => value[0] === '22520030')?.[6]).toBe(
      'Chưa có đề tài',
    );
  });

  it('chooses the lowest topic code when registrations share the same priority', () => {
    const base = row('VB1-03');
    const later: TopicStatisticsRow = {
      ...base,
      topic: { ...base.topic, id: 'different-topic', code: 'VB1-99' },
    };
    const student = seedParticipants().student.find((candidate) =>
      base.topic.group.some((member) => member.id === candidate.id),
    );
    if (!student) throw new Error('Missing fixture student');

    const data: RoundStatistics = {
      roundId: 'r-vb1-hk1',
      roundName: 'Văn bằng 1',
      roundStatus: 'Đang diễn ra',
      snapshotAt: new Date().toISOString(),
      loads: [],
      gradesAvailable: false,
      items: [later, base],
      students: [student],
    };

    expect(registrationStatisticsTable(data).rows[0][3]).toBe('VB1-03');
  });
});
