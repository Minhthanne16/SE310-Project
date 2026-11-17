import type { Participant } from '@/types/round';
import type { LecturerLoadDto, TopicDto } from '@/types/topic';
import {
  REGISTRATION_HEADER,
  TOPIC_LIST_HEADER,
  buildRegistrationTable,
} from '@/features/topics/topicExport';
import { toTopic } from '@/features/topics/services/topicApiService';
import type { XlsxTable } from '@/lib/xlsx';

export const STAGES = [
  'Đăng ký',
  'Đề cương',
  'Giữa kỳ',
  'Cuối kỳ',
  'Đánh giá',
  'Kết quả',
] as const;

export interface TopicStatisticsRow {
  topic: TopicDto;
  stages: boolean[];
  progress: string;
}

export interface StatisticsLoad extends LecturerLoadDto {
  lecturerCode: string;
  lecturerName: string;
}

export interface RoundStatistics {
  roundId: string;
  roundName: string;
  roundStatus: string;
  snapshotAt: string;
  items: TopicStatisticsRow[];
  loads: StatisticsLoad[];
  students: Participant[];
  gradesAvailable: boolean;
}

export interface StatisticsFilters {
  status: string;
  search: string;
  supervisorId: string;
}

export function filterStatistics(
  rows: TopicStatisticsRow[],
  filters: StatisticsFilters,
): TopicStatisticsRow[] {
  const search = filters.search.trim().toLocaleLowerCase('vi');
  return rows
    .filter(
      ({ topic }) =>
        (!filters.status || topic.status === filters.status) &&
        (!filters.supervisorId ||
          topic.supervisor.id === filters.supervisorId) &&
        (!search ||
          [
            topic.code,
            topic.title,
            topic.supervisor.code,
            topic.supervisor.name,
            ...topic.group.flatMap((member) => [member.code, member.name]),
          ].some((value) => value.toLocaleLowerCase('vi').includes(search))),
    )
    .sort((a, b) => a.topic.code.localeCompare(b.topic.code));
}

export function topicStatisticsTable(rows: TopicStatisticsRow[]): XlsxTable {
  return {
    sheetName: 'Đề tài',
    header: TOPIC_LIST_HEADER,
    rows: rows.map(({ topic, progress }) => [
      topic.code,
      topic.title,
      topic.field,
      topic.supervisor.name,
      topic.group.map((member) => `${member.code} ${member.name}`).join('; '),
      topic.source,
      topic.status,
      progress,
    ]),
  };
}

export function registrationStatisticsTable(data: RoundStatistics): XlsxTable {
  const topics = [...data.items].sort((a, b) =>
    a.topic.code.localeCompare(b.topic.code),
  );
  const table = buildRegistrationTable(
    data.students,
    topics.map((item) => toTopic(item.topic)),
  );
  return { ...table, header: REGISTRATION_HEADER };
}
