import { nameKey } from '@/features/rounds/roundValidation';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { DEMO_TODAY } from '@/features/rounds/services/roundSeed';
import { seedTopics } from '@/features/topics/services/topicSeed';
import { lecturerLoads } from '@/features/topics/topicUtils';
import type {
  Topic,
  TopicFilters,
  TopicList,
  TopicPerson,
  TopicRoundState,
} from '@/types/topic';

export class TopicNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy đề tài.');
    this.name = 'TopicNotFoundError';
  }
}

// Hợp đồng chung của các màn đề tài của Giáo vụ (danh sách, chi tiết, tab Đề tài). Component chỉ phụ thuộc
// interface này nên khi backend có API chỉ cần thay phần cài đặt.
export interface TopicService {
  readonly today: string;
  list(filters: TopicFilters): Promise<TopicList>;
  get(id: string): Promise<Topic>;
  // Tên và trạng thái của đợt chứa đề tài.
  roundState(roundId: string): Promise<TopicRoundState>;
  // GVHD của các đề tài trong đợt (cho ô lọc), theo danh sách giảng viên của đợt.
  listSupervisors(roundId: string): Promise<TopicPerson[]>;
}

interface TopicServiceOptions {
  today?: string;
  // Dùng để lấy đợt, mốc "GV gửi đề tài" và giảng viên của đợt.
  roundService?: RoundService;
  topics?: Topic[];
  // Mức tối thiểu/tối đa đề tài mỗi giảng viên; mặc định lấy hằng số tạm (0 = chưa đặt).
  loadLimits?: { min: number; max: number };
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

  const roundState = async (roundId: string): Promise<TopicRoundState> => {
    // Ném RoundNotFoundError khi không có đợt.
    const round = await rounds.get(roundId);
    return { roundId, roundName: round.name, roundStatus: round.status };
  };

  const matches = (t: Topic, f: TopicFilters): boolean => {
    const keyword = nameKey(f.search ?? '');
    return (
      t.roundId === f.roundId &&
      (!f.supervisorId || t.supervisor.id === f.supervisorId) &&
      (!f.status || f.status === 'Tất cả' || t.status === f.status) &&
      (!keyword ||
        nameKey(t.title).includes(keyword) ||
        nameKey(t.code).includes(keyword) ||
        nameKey(t.supervisor.name).includes(keyword) ||
        (t.reviewer !== null && nameKey(t.reviewer.name).includes(keyword)) ||
        t.group.some(
          (m) =>
            nameKey(m.name).includes(keyword) ||
            nameKey(m.code).includes(keyword),
        ))
    );
  };

  const filtered = (f: TopicFilters) =>
    topics
      .filter((t) => matches(t, f))
      .sort((a, b) => a.code.localeCompare(b.code));

  return {
    today,

    // Đề xuất: GET /api/rounds/{id} (tên và trạng thái đợt).
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
        loads: lecturerLoads(
          all,
          round.lecturerIds,
          options.loadLimits ?? {
            min: round.lecturerLoadMin,
            max: round.lecturerLoadMax,
          },
        ),
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
  };
}

export const topicService: TopicService = createTopicService();
