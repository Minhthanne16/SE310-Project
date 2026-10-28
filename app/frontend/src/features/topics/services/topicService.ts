import { nameKey } from '@/features/rounds/roundValidation';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { DEMO_TODAY } from '@/features/rounds/services/roundSeed';
import { SEED_PHASES, seedTopics } from '@/features/topics/services/topicSeed';
import { buildTopicsCsv, lecturerLoads } from '@/features/topics/topicUtils';
import type {
  Topic,
  TopicFilters,
  TopicList,
  TopicPerson,
  TopicPhase,
  TopicRoundState,
} from '@/types/topic';

export class TopicNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy đề tài.');
    this.name = 'TopicNotFoundError';
  }
}

// Vi phạm quy tắc nghiệp vụ (công bố khi chưa hết hạn, đã công bố...).
export class TopicRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopicRuleError';
  }
}

export interface TopicCsvExport {
  csv: string;
  // Số đề tài trong tệp; 0 = danh sách trống, giao diện báo thay vì tải.
  count: number;
}

// Hợp đồng chung của hai màn đề tài của Giáo vụ. Component chỉ phụ thuộc
// interface này nên khi backend có API chỉ cần thay phần cài đặt.
export interface TopicService {
  readonly today: string;
  list(filters: TopicFilters): Promise<TopicList>;
  get(id: string): Promise<Topic>;
  // Giai đoạn đề tài và điều kiện công bố của một đợt.
  roundState(roundId: string): Promise<TopicRoundState>;
  // GVHD của các đề tài trong đợt (cho ô lọc), theo danh sách giảng viên của đợt.
  listSupervisors(roundId: string): Promise<TopicPerson[]>;
  publish(roundId: string): Promise<TopicRoundState>;
  exportCsv(filters: TopicFilters): Promise<TopicCsvExport>;
}

interface TopicServiceOptions {
  today?: string;
  // Dùng để lấy đợt, mốc "GV gửi đề tài" và giảng viên của đợt.
  roundService?: RoundService;
  topics?: Topic[];
  phases?: Record<string, TopicPhase>;
}

const cloneTopic = (t: Topic): Topic => ({
  ...t,
  supervisor: { ...t.supervisor },
  group: t.group.map((m) => ({ ...m })),
  reviewer: t.reviewer ? { ...t.reviewer } : null,
  submissions: t.submissions.map((s) => ({ ...s })),
  scores: t.scores.map((s) => ({ ...s, scores: { ...s.scores } })),
  history: t.history.map((h) => ({ ...h })),
});

// DEMO: backend chưa có API đề tài (docs/DESIGN/03). Toàn bộ chạy trên kho
// trong bộ nhớ; mất khi tải lại trang. Endpoint đề xuất nằm ở chú thích từng
// hàm; khi backend có, thay thân hàm bằng apiRequest và giữ nguyên interface.
export function createTopicService(
  options: TopicServiceOptions = {},
): TopicService {
  const today = options.today ?? DEMO_TODAY;
  const rounds = options.roundService ?? defaultRoundService;
  const topics = options.topics ?? seedTopics();
  const phases: Record<string, TopicPhase> = {
    ...(options.phases ?? SEED_PHASES),
  };

  const roundState = async (roundId: string): Promise<TopicRoundState> => {
    // Ném RoundNotFoundError khi không có đợt.
    const round = await rounds.get(roundId);
    const milestone = round.milestones.find((m) => m.key === 'topicSubmission');
    const deadline = milestone?.endDate ?? '';
    const phase = phases[roundId] ?? 'Đang gửi đề tài';
    const deadlinePassed = deadline !== '' && today > deadline;
    const total = topics.filter((t) => t.roundId === roundId).length;
    let reason: string | null = null;
    if (phase === 'Đã công bố danh sách') reason = 'Danh sách đã được công bố.';
    else if (round.status !== 'Đang diễn ra')
      reason = 'Chỉ công bố được danh sách của đợt đang diễn ra.';
    else if (!deadline) reason = 'Chưa đặt hạn gửi đề tài của đợt.';
    else if (!deadlinePassed) reason = 'Chưa hết hạn gửi đề tài.';
    else if (total === 0) reason = 'Chưa có đề tài để công bố.';
    return {
      roundId,
      roundName: round.name,
      roundStatus: round.status,
      phase,
      submissionDeadline: deadline,
      deadlinePassed,
      canPublish: reason === null,
      publishBlockedReason: reason,
    };
  };

  const matches = (t: Topic, f: TopicFilters): boolean => {
    const keyword = nameKey(f.search ?? '');
    return (
      t.roundId === f.roundId &&
      (!f.supervisorId || t.supervisor.id === f.supervisorId) &&
      (!f.status || f.status === 'Tất cả' || t.status === f.status) &&
      (!keyword ||
        nameKey(t.title).includes(keyword) ||
        nameKey(t.code).includes(keyword))
    );
  };

  const filtered = (f: TopicFilters) =>
    topics
      .filter((t) => matches(t, f))
      .sort((a, b) => a.code.localeCompare(b.code));

  return {
    today,

    // Đề xuất: GET /api/rounds/{id}/topics/state → TopicRoundStateDto.
    roundState,

    // Đề xuất: GET /api/topics?roundId=&supervisorId=&status=&search=
    // → { round, items, roundTotal, loads }; phân trang phía máy chủ khi dữ
    // liệu lớn. `loads` tính trên cả đợt (không theo bộ lọc).
    async list(filters) {
      const round = await rounds.get(filters.roundId);
      const all = topics.filter((t) => t.roundId === filters.roundId);
      return {
        round: await roundState(filters.roundId),
        items: filtered(filters).map(cloneTopic),
        roundTotal: all.length,
        loads: lecturerLoads(all, round.lecturerIds),
      };
    },

    // Đề xuất: GET /api/topics/{id} → TopicDto đầy đủ; 404 khi không có.
    async get(id) {
      const topic = topics.find((t) => t.id === id);
      if (!topic) throw new TopicNotFoundError();
      return cloneTopic(topic);
    },

    // Đề xuất: GET /api/rounds/{id}/lecturers (đã có thể dùng chung với tab
    // Giảng viên của chi tiết đợt).
    async listSupervisors(roundId) {
      const round = await rounds.get(roundId);
      const people = await rounds.listParticipants('lecturer');
      return people
        .filter((p) => round.lecturerIds.includes(p.id))
        .map((p) => ({ id: p.id, code: p.code, name: p.name }));
    },

    // Đề xuất: POST /api/rounds/{id}/topics/publish → TopicRoundStateDto;
    // 409 khi chưa hết hạn gửi đề tài, đã công bố, đợt không đang diễn ra hoặc
    // chưa có đề tài. Không đảo ngược được. Sau đó GV không thêm/xóa đề tài,
    // chỉ sửa mô tả và yêu cầu của đề tài chưa có nhóm (khóa Lĩnh vực).
    async publish(roundId) {
      const state = await roundState(roundId);
      if (!state.canPublish)
        throw new TopicRuleError(
          state.publishBlockedReason ?? 'Không công bố được danh sách.',
        );
      phases[roundId] = 'Đã công bố danh sách';
      await rounds.markTopicsPublished(roundId);
      return roundState(roundId);
    },

    // Đề xuất: GET /api/topics/export?roundId=&… (text/csv) với cùng bộ lọc
    // như danh sách. Ô bắt đầu bằng = + - @ được chặn công thức.
    async exportCsv(filters) {
      await rounds.get(filters.roundId);
      const items = filtered(filters);
      return { csv: buildTopicsCsv(items), count: items.length };
    },
  };
}

export const topicService: TopicService = createTopicService();
