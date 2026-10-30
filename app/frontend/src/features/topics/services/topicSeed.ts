import { addDays } from '@/features/rounds/roundUtils';
import { seedParticipants } from '@/features/rounds/services/roundSeed';
import type { Participant } from '@/types/round';
import {
  SCORE_ROLES,
  type HistoryCategory,
  type RoleScores,
  type SubmissionKind,
  type Topic,
  type TopicHistoryEntry,
  type TopicPerson,
  type TopicPhase,
  type TopicSource,
  type TopicStatus,
  type TopicSubmission,
} from '@/types/topic';

// Giáo vụ đang đăng nhập trong demo (cùng tên với thông báo mẫu của đợt).
const STAFF = 'Phạm Minh Châu';

// Giai đoạn ban đầu của từng đợt. Chỉ đợt Thạc sĩ còn "Đang gửi đề tài" (đã
// hết hạn gửi nhưng chưa công bố, nên đề tài GV gửi đều Chưa đăng ký, chưa có
// nhóm); các đợt khác đã công bố. Đợt Nháp không có đề tài. Mọi sự kiện mẫu
// nằm trong cửa sổ mốc của đợt và không muộn hơn DEMO_TODAY (2026-10-26).
export const SEED_PHASES: Record<string, TopicPhase> = {
  'r-vb1-hk1': 'Đã công bố danh sách',
  'r-vb2-hk1': 'Đã công bố danh sách',
  'r-ths-1-2026': 'Đang gửi đề tài',
  'r-vb1-hk2-2025': 'Đã công bố danh sách',
};

type Scores4 = [number | null, number | null, number | null, number | null];
// [loại bài nộp, số ngày kể từ mốc đầu của đợt, nộp trễ]
type SubSpec = [SubmissionKind, number, boolean];

interface Spec {
  round: string;
  codePrefix: string;
  // Ngày gốc để suy ra thời điểm các sự kiện trong lịch sử.
  base: string;
  n: number;
  title: string;
  field: string;
  sup: string;
  source: TopicSource;
  status: TopicStatus;
  students?: string[];
  reviewer?: string;
  council?: string;
  subs?: SubSpec[];
  scores?: Scores4[];
  // Số ngày kể từ mốc đầu của đợt tới lúc nhập phiếu (mặc định 124, trong
  // "Thời gian cho điểm" của đợt đã kết thúc).
  scoreAt?: number;
}

type Body = Omit<Spec, 'round' | 'codePrefix' | 'base' | 'n'>;

const FIELD_REQUIREMENTS: Record<string, string> = {
  'Phát triển phần mềm':
    'Có sản phẩm chạy được, tài liệu thiết kế và bộ kiểm thử tự động.',
  'Trí tuệ nhân tạo':
    'Có tập dữ liệu rõ nguồn, so sánh ít nhất hai phương pháp và báo cáo độ đo.',
  'An toàn thông tin':
    'Có mô hình mối đe dọa, thử nghiệm trong môi trường cô lập và đề xuất khắc phục.',
  'Hệ thống thông tin':
    'Có phân tích nghiệp vụ, mô hình dữ liệu và bản demo với dữ liệu mẫu.',
  'Mạng máy tính':
    'Có sơ đồ triển khai, kịch bản đo kiểm và số liệu hiệu năng.',
  'Khoa học dữ liệu':
    'Có quy trình xử lý dữ liệu tái lập được và trực quan hóa kết quả.',
};

const S = (n: number) => `225200${String(n).padStart(2, '0')}`;
const GV: TopicSource = 'GV công bố';
const SV: TopicSource = 'SV đề xuất';

function specsFor(
  round: string,
  codePrefix: string,
  base: string,
  bodies: Body[],
): Spec[] {
  return bodies.map((body, i) => ({
    ...body,
    round,
    codePrefix,
    base,
    n: i + 1,
  }));
}

// Nhóm của VB1: mã sinh viên 22520001–22520004 và 22520013–22520030 thuộc đợt
// (xem seedParticipants). Mỗi sinh viên chỉ ở một nhóm.
const vb1: Body[] = [
  {
    title: 'Hệ thống quản lý phòng khám nhỏ',
    field: 'Phát triển phần mềm',
    sup: 'CB101',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Ứng dụng nhắc lịch học cho sinh viên',
    field: 'Phát triển phần mềm',
    sup: 'CB101',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Nền tảng đặt sân thể thao trực tuyến',
    field: 'Phát triển phần mềm',
    sup: 'CB101',
    source: GV,
    status: 'Đã đăng ký',
    students: [S(1), S(2)],
  },
  {
    title: 'Chatbot hỗ trợ tuyển sinh',
    field: 'Trí tuệ nhân tạo',
    sup: 'CB101',
    source: GV,
    status: 'Đang thực hiện',
    students: [S(3), S(4)],
    reviewer: 'CB103',
    subs: [
      ['Đề cương', 30, false],
      ['Giữa kỳ', 44, false],
    ],
  },
  {
    title: 'Phát hiện gian lận trong thi trực tuyến',
    field: 'Trí tuệ nhân tạo',
    sup: 'CB101',
    source: GV,
    status: 'Đang thực hiện',
    students: [S(13)],
    subs: [
      ['Đề cương', 38, false],
      ['Đề cương', 41, true],
    ],
  },
  {
    title: 'Hệ thống gợi ý tài liệu học tập',
    field: 'Khoa học dữ liệu',
    sup: 'CB101',
    source: GV,
    status: 'Đang thực hiện',
    students: [S(14), S(15)],
    reviewer: 'CB102',
    subs: [
      ['Đề cương', 30, false],
      ['Giữa kỳ', 46, false],
    ],
  },
  {
    title: 'Ứng dụng quản lý chi tiêu cá nhân',
    field: 'Phát triển phần mềm',
    sup: 'CB101',
    source: SV,
    status: 'Đã đăng ký',
    students: [S(16)],
  },
  {
    title: 'Kiểm thử bảo mật ứng dụng web thương mại',
    field: 'An toàn thông tin',
    sup: 'CB101',
    source: GV,
    status: 'Đang thực hiện',
    students: [S(17), S(18)],
    reviewer: 'CB103',
    subs: [
      ['Đề cương', 33, false],
      ['Giữa kỳ', 47, false],
    ],
  },
  {
    title: 'Cổng thông tin cựu sinh viên',
    field: 'Hệ thống thông tin',
    sup: 'CB102',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Kho dữ liệu cho báo cáo đào tạo',
    field: 'Hệ thống thông tin',
    sup: 'CB102',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Phân tích cảm xúc đánh giá môn học',
    field: 'Khoa học dữ liệu',
    sup: 'CB102',
    source: SV,
    status: 'Chờ GV duyệt',
    students: [S(19), S(20)],
  },
  {
    title: 'Mạng xã hội cho câu lạc bộ sinh viên',
    field: 'Phát triển phần mềm',
    sup: 'CB102',
    source: SV,
    status: 'Bị từ chối',
    students: [S(21)],
  },
  {
    title: 'Quản lý thư viện khoa bằng mã QR',
    field: 'Hệ thống thông tin',
    sup: 'CB102',
    source: GV,
    status: 'Đang thực hiện',
    students: [S(22), S(23)],
    reviewer: 'CB101',
    subs: [
      ['Đề cương', 32, false],
      ['Giữa kỳ', 49, false],
    ],
  },
  {
    title: 'Tối ưu truy vấn cho hệ thống bán vé',
    field: 'Hệ thống thông tin',
    sup: 'CB102',
    source: GV,
    status: 'Đã đăng ký',
    students: [S(24)],
  },
  {
    title: 'Giám sát điện năng tòa nhà bằng IoT',
    field: 'Mạng máy tính',
    sup: 'CB102',
    source: SV,
    status: 'Đang thực hiện',
    students: [S(25), S(26)],
    reviewer: 'CB103',
    subs: [['Đề cương', 35, false]],
  },
  {
    title: 'Nhận dạng biển số xe ở bãi đỗ',
    field: 'Trí tuệ nhân tạo',
    sup: 'CB102',
    source: GV,
    status: 'Đang thực hiện',
    students: [S(27)],
    reviewer: 'CB101',
    subs: [
      ['Đề cương', 34, false],
      ['Giữa kỳ', 48, false],
    ],
  },
  {
    title: 'Giám sát chất lượng mạng ký túc xá',
    field: 'Mạng máy tính',
    sup: 'CB103',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Hệ thống phát hiện xâm nhập mạng nội bộ',
    field: 'An toàn thông tin',
    sup: 'CB103',
    source: GV,
    status: 'Đang thực hiện',
    students: [S(28), S(29)],
    reviewer: 'CB102',
    subs: [
      ['Đề cương', 31, false],
      ['Giữa kỳ', 45, false],
    ],
    // Mới có phiếu CBHD: ví dụ "Chưa đủ điểm".
    scoreAt: 48,
    scores: [
      [null, null, 8, null],
      [null, null, 7.5, null],
    ],
  },
];

// Đã hết hạn gửi đề tài nhưng chưa công bố: đề tài GV gửi chưa có nhóm.
const ths: Body[] = [
  {
    title: 'Học tăng cường cho điều phối giao thông',
    field: 'Trí tuệ nhân tạo',
    sup: 'CB105',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Mô hình ngôn ngữ cho tra cứu văn bản pháp luật',
    field: 'Trí tuệ nhân tạo',
    sup: 'CB105',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Phát hiện bất thường trong nhật ký hệ thống',
    field: 'An toàn thông tin',
    sup: 'CB106',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Kiến trúc vi dịch vụ cho hệ thống học trực tuyến',
    field: 'Phát triển phần mềm',
    sup: 'CB101',
    source: GV,
    status: 'Chưa đăng ký',
  },
  {
    title: 'Trích xuất thông tin từ hóa đơn bằng học sâu',
    field: 'Trí tuệ nhân tạo',
    sup: 'CB106',
    source: SV,
    status: 'Chờ GV duyệt',
    students: [S(8)],
  },
  {
    title: 'Tối ưu hóa lịch bảo trì thiết bị',
    field: 'Khoa học dữ liệu',
    sup: 'CB105',
    source: SV,
    status: 'Bị từ chối',
    students: [S(9)],
  },
];

const vb2: Body[] = [
  {
    title: 'Hệ thống điểm danh bằng nhận diện khuôn mặt',
    field: 'Trí tuệ nhân tạo',
    sup: 'CB102',
    source: GV,
    status: 'Đã đăng ký',
    students: [S(5)],
  },
  {
    title: 'Ứng dụng quản lý hồ sơ bệnh nhân ngoại trú',
    field: 'Hệ thống thông tin',
    sup: 'CB104',
    source: SV,
    status: 'Đã đăng ký',
    students: [S(6)],
  },
  {
    title: 'Dự đoán nhu cầu thuê xe đạp công cộng',
    field: 'Khoa học dữ liệu',
    sup: 'CB104',
    source: SV,
    status: 'Chờ GV duyệt',
    students: [S(7)],
  },
];

// Đợt HK2 2025–2026 đã kết thúc: đề cương 28–39, giữa kỳ 56–67, cuối kỳ
// 91–102 (kể từ mốc đầu 2026-02-02).
const OLD_SUBS: SubSpec[] = [
  ['Đề cương', 30, false],
  ['Giữa kỳ', 60, false],
  ['Cuối kỳ', 97, false],
  ['Bản khóa luận', 101, false],
];

const old: Body[] = [
  {
    title: 'Website bán hàng thủ công mỹ nghệ',
    field: 'Phát triển phần mềm',
    sup: 'CB101',
    source: GV,
    status: 'Đã hoàn tất',
    students: [S(10)],
    reviewer: 'CB103',
    council: 'Hội đồng 1',
    subs: OLD_SUBS,
    scores: [[8.5, 8.5, 9, 8.5]],
  },
  {
    title: 'Hệ thống quản lý kho vận',
    field: 'Hệ thống thông tin',
    sup: 'CB103',
    source: GV,
    status: 'Đã hoàn tất',
    students: [S(11)],
    reviewer: 'CB101',
    council: 'Hội đồng 1',
    subs: OLD_SUBS,
    scores: [[8, 8, 8, 8.5]],
  },
  {
    title: 'Giải pháp cân bằng tải cho cụm web',
    field: 'Mạng máy tính',
    sup: 'CB103',
    source: SV,
    status: 'Đã cho điểm',
    students: [S(12)],
    reviewer: 'CB101',
    council: 'Hội đồng 2',
    subs: OLD_SUBS,
    scores: [[9, 8.5, 9, 9]],
  },
];

const SPECS: Spec[] = [
  ...specsFor('r-vb1-hk1', 'VB1', '2026-09-07', vb1),
  ...specsFor('r-vb2-hk1', 'VB2', '2026-09-14', vb2),
  ...specsFor('r-ths-1-2026', 'THS', '2026-08-03', ths),
  ...specsFor('r-vb1-hk2-2025', 'VB1-25', '2026-02-02', old),
];

const FILE_SLUG: Record<SubmissionKind, string> = {
  'Đề cương': 'de-cuong',
  'Giữa kỳ': 'giua-ky',
  'Cuối kỳ': 'cuoi-ky',
  'Bản khóa luận': 'khoa-luan',
};

const toPerson = (p: Participant): TopicPerson => ({
  id: p.id,
  code: p.code,
  name: p.name,
});

function buildTopic(
  spec: Spec,
  students: Map<string, Participant>,
  lecturers: Map<string, Participant>,
): Topic {
  const supervisor = toPerson(lecturers.get(spec.sup)!);
  const reviewer = spec.reviewer
    ? toPerson(lecturers.get(spec.reviewer)!)
    : null;
  const group = (spec.students ?? []).map((id, i) => ({
    ...toPerson(students.get(id)!),
    representative: i === 0,
  }));
  const code = `${spec.codePrefix}-${String(spec.n).padStart(2, '0')}`;
  const id = `t-${code.toLowerCase()}`;
  const rep = group[0]?.name ?? '';
  const finished =
    spec.status === 'Đã cho điểm' || spec.status === 'Đã hoàn tất';
  const scoreAt = spec.scoreAt ?? 124;
  const hhmm = (minutes: number) =>
    `${String(9 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
  const at = (offset: number, minutes = 0) =>
    `${addDays(spec.base, offset)}T${hhmm(minutes)}`;

  const submissions: TopicSubmission[] = (spec.subs ?? []).map(
    ([kind, offset, late], i) => ({
      versionNo: i + 1,
      kind,
      submittedBy: rep,
      submittedAt: at(offset),
      late,
      fileName: `${code}-${FILE_SLUG[kind]}-v${i + 1}.pdf`,
    }),
  );

  const scores = (spec.scores ?? []).map((row, i) => ({
    studentId: group[i].id,
    code: group[i].code,
    name: group[i].name,
    scores: Object.fromEntries(
      SCORE_ROLES.map((role, k) => [role, row[k]]),
    ) as RoleScores,
  }));

  const events: Omit<TopicHistoryEntry, 'id'>[] = [];
  const log = (
    when: string,
    actor: string,
    category: HistoryCategory,
    action: string,
    detail?: string,
  ) => events.push({ at: when, actor, category, action, detail });

  if (spec.source === SV && group.length > 0)
    log(
      at(15, 5),
      rep,
      'Trạng thái',
      'Gửi đề xuất đề tài',
      `Gửi tới ${supervisor.name}.`,
    );
  if (spec.status === 'Bị từ chối')
    log(
      at(17),
      supervisor.name,
      'Trạng thái',
      'Từ chối đề xuất',
      'Lý do: phạm vi đề tài quá rộng so với thời gian của đợt.',
    );
  else if (spec.source === SV && spec.status !== 'Chờ GV duyệt')
    log(
      at(17),
      supervisor.name,
      'Trạng thái',
      'Chấp nhận đề xuất',
      'Đề tài chuyển sang Đã đăng ký.',
    );
  if (spec.source === GV && group.length > 0) {
    log(
      at(14),
      rep,
      'Nhóm',
      'Đăng ký đề tài',
      `Nhóm ${group.length} sinh viên.`,
    );
    log(at(14, 1), 'Hệ thống', 'Trạng thái', 'Chuyển trạng thái', 'Đã đăng ký');
  }
  if (group.length === 2)
    log(at(14, 2), rep, 'Nhóm', 'Chọn đại diện nhóm', `Đại diện: ${rep}.`);
  if (reviewer)
    log(
      at(finished ? 90 : 40),
      STAFF,
      'Phân công',
      'Phân công GV phản biện',
      reviewer.name,
    );
  if (spec.council)
    log(at(100), STAFF, 'Phân công', 'Phân công hội đồng', spec.council);
  for (const s of submissions)
    log(
      s.submittedAt,
      s.submittedBy,
      'Bài nộp',
      `Nộp ${s.kind} (v${s.versionNo})`,
      s.late ? 'Nộp trễ.' : undefined,
    );
  const outline = submissions.findLast((s) => s.kind === 'Đề cương');
  if (outline)
    log(
      `${addDays(outline.submittedAt.slice(0, 10), 2)}T10:00:00`,
      supervisor.name,
      'Trạng thái',
      'Duyệt đề cương',
      'Đề tài chuyển sang Đang thực hiện.',
    );
  scores.forEach((s, i) => {
    const filled = SCORE_ROLES.filter((r) => s.scores[r] !== null);
    if (filled.length > 0)
      log(
        at(scoreAt, i),
        supervisor.name,
        'Điểm',
        `Nhập điểm cho ${s.name}`,
        `Phiếu: ${filled.join(', ')}.`,
      );
  });
  if (spec.status === 'Đã cho điểm' || spec.status === 'Đã hoàn tất')
    log(
      at(scoreAt + 1),
      'Hệ thống',
      'Trạng thái',
      'Chuyển trạng thái',
      'Đã cho điểm',
    );
  if (spec.status === 'Đã hoàn tất')
    log(at(135), STAFF, 'Trạng thái', 'Công bố kết quả', 'Đã hoàn tất');

  const history = events
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((e, i) => ({ id: `${id}-h${i + 1}`, ...e }));

  return {
    id,
    roundId: spec.round,
    code,
    title: spec.title,
    description: `Nghiên cứu và hiện thực đề tài “${spec.title}” trong lĩnh vực ${spec.field.toLowerCase()}.`,
    requirements: FIELD_REQUIREMENTS[spec.field],
    field: spec.field,
    supervisor,
    source: spec.source,
    status: spec.status,
    group,
    reviewer,
    council: spec.council ?? null,
    submissions,
    scores,
    history,
  };
}

// Đề tài mẫu: VB1 có đủ bảy trạng thái và một GV vượt mức; các đợt khác ít
// hơn; đợt Nháp không có đề tài. Số theo trạng thái phải khớp topicSummary
// trong roundSeed.ts (có test giữ đồng bộ). Đề tài Chưa đăng ký chưa có sự
// kiện nào cần truy vết nên lịch sử rỗng (03: trạng thái "Lịch sử trống").
export function seedTopics(): Topic[] {
  const { lecturer, student } = seedParticipants();
  const lecturers = new Map(lecturer.map((p) => [p.id, p]));
  const students = new Map(student.map((p) => [p.id, p]));
  return SPECS.map((spec) => buildTopic(spec, students, lecturers));
}
