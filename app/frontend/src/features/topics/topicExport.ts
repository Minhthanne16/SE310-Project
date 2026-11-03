import { thesisProgress } from '@/features/topics/topicUtils';
import { slugify, type XlsxTable } from '@/lib/xlsx';
import type { Participant } from '@/types/round';
import type { Topic } from '@/types/topic';

// Hai danh sách xuất ra Excel từ tab Đề tài của chi tiết đợt.
export type TopicExportKind = 'topics' | 'registrations';

export const TOPIC_LIST_HEADER = [
  'Mã',
  'Tên đề tài',
  'Lĩnh vực',
  'GV hướng dẫn',
  'Nhóm',
  'Nguồn',
  'Trạng thái',
  'Tiến độ khóa luận',
];

// Danh sách đề tài (theo bộ lọc đang chọn của tab), sắp theo mã.
export function buildTopicListTable(topics: Topic[]): XlsxTable {
  return {
    sheetName: 'Đề tài',
    header: TOPIC_LIST_HEADER,
    rows: [...topics]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((t) => [
        t.code,
        t.title,
        t.field,
        t.supervisor.name,
        t.group.map((m) => `${m.code} ${m.name}`).join('; '),
        t.source,
        t.status,
        thesisProgress(t),
      ]),
  };
}

export type RegistrationStatus =
  'Đã đăng ký' | 'Chờ GV duyệt' | 'Bị từ chối' | 'Chưa có đề tài';

// Mức ưu tiên khi một sinh viên nằm trong nhiều đề tài (ví dụ một đề xuất bị
// từ chối rồi đăng ký đề tài khác): lấy trạng thái tốt nhất.
const REGISTRATION_RANK: Record<RegistrationStatus, number> = {
  'Đã đăng ký': 3,
  'Chờ GV duyệt': 2,
  'Bị từ chối': 1,
  'Chưa có đề tài': 0,
};

// Trạng thái đăng ký của một thành viên nhóm, suy ra từ trạng thái đề tài.
export function registrationStatusOf(topic: Topic): RegistrationStatus {
  if (topic.status === 'Chờ GV duyệt') return 'Chờ GV duyệt';
  if (topic.status === 'Bị từ chối') return 'Bị từ chối';
  return 'Đã đăng ký';
}

export const REGISTRATION_HEADER = [
  'MSSV',
  'Họ tên',
  'Lớp',
  'Mã đề tài',
  'Tên đề tài',
  'GV hướng dẫn',
  'Trạng thái đăng ký',
];

// Danh sách đăng ký: mỗi sinh viên của đợt một dòng, sắp theo MSSV. Sinh viên
// chưa nằm trong nhóm nào là "Chưa có đề tài" (các cột đề tài để trống).
export function buildRegistrationTable(
  students: Participant[],
  topics: Topic[],
): XlsxTable {
  const rows = [...students]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((student) => {
      let best: { topic: Topic; status: RegistrationStatus } | null = null;
      for (const topic of topics) {
        if (!topic.group.some((m) => m.id === student.id)) continue;
        const status = registrationStatusOf(topic);
        if (!best || REGISTRATION_RANK[status] > REGISTRATION_RANK[best.status])
          best = { topic, status };
      }
      return [
        student.code,
        student.name,
        student.unit,
        best?.topic.code ?? '',
        best?.topic.title ?? '',
        best?.topic.supervisor.name ?? '',
        best?.status ?? 'Chưa có đề tài',
      ];
    });
  return { sheetName: 'Đăng ký', header: REGISTRATION_HEADER, rows };
}

// danh-sach-de-tai-van-bang-1-hk1-2026-2027.xlsx
export function exportFileName(
  kind: TopicExportKind,
  roundName: string,
): string {
  const prefix = kind === 'topics' ? 'danh-sach-de-tai' : 'danh-sach-dang-ky';
  const slug = slugify(roundName);
  return `${prefix}${slug ? `-${slug}` : ''}.xlsx`;
}
