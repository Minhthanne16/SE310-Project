import { nameKey } from '@/features/rounds/roundValidation';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { DEMO_TODAY } from '@/features/rounds/services/roundSeed';
import { finalLockClosed } from '@/features/rounds/roundUtils';
import { seedTopics } from '@/features/topics/services/topicSeed';
import {
  confirmResultBlocker,
  deviationRecipients,
  lecturerLoads,
  publishResultBlocker,
  remindDeviationBlocker,
} from '@/features/topics/topicUtils';
import type {
  HistoryCategory,
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

// Kết quả xử lý một đề tài khi xác nhận, hủy xác nhận, công bố hoặc nhắc lệch
// điểm. Thao tác theo lô trả một phần tử cho mỗi đề tài: đề tài không hợp lệ
// giữ nguyên trạng thái và có lý do (PDR-049).
export interface ResultOutcome {
  topicId: string;
  code: string;
  title: string;
  ok: boolean;
  message: string;
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
  // Xác nhận kết quả theo cả nhóm: chỉ đề tài Đã cho điểm (suy lại từ phiếu).
  confirmResults(ids: string[]): Promise<ResultOutcome[]>;
  // Hủy xác nhận trước khi công bố; bắt buộc có lý do. Đề tài về Đã cho điểm.
  unconfirmResult(id: string, reason: string): Promise<ResultOutcome>;
  // Công bố kết quả: đề tài Đã xác nhận và đã chốt bản cuối (hoặc hết hạn chốt
  // tính theo `today`, mặc định hôm nay của service) → Đã hoàn tất.
  publishResults(ids: string[], today?: string): Promise<ResultOutcome[]>;
  // Nhắc các giảng viên trong cặp lệch xem lại phiếu (không gửi sinh viên).
  remindDeviations(ids: string[], message?: string): Promise<ResultOutcome[]>;
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

  const stamp = (at: string) => `${at}T09:00:00`;

  // Ghi một dòng lịch sử mới nhất trước, actor cố định là Giáo vụ.
  const addHistory = (
    t: Topic,
    category: HistoryCategory,
    action: string,
    detail?: string,
  ) => {
    t.history.unshift({
      id: `${t.id}-h${t.history.length + 1}`,
      at: stamp(today),
      actor: 'Giáo vụ',
      category,
      action,
      detail,
    });
  };

  const outcome = (t: Topic, ok: boolean, message: string): ResultOutcome => ({
    topicId: t.id,
    code: t.code,
    title: t.title,
    ok,
    message,
  });

  const missing = (id: string): ResultOutcome => ({
    topicId: id,
    code: id,
    title: '',
    ok: false,
    message: 'Bỏ qua: không tìm thấy đề tài.',
  });

  // Xử lý lần lượt từng đề tài; mã trùng chỉ tính một lần.
  const eachTopic = async (
    ids: string[],
    run: (t: Topic) => ResultOutcome | Promise<ResultOutcome>,
  ): Promise<ResultOutcome[]> => {
    const out: ResultOutcome[] = [];
    for (const id of new Set(ids)) {
      const t = topics.find((x) => x.id === id);
      out.push(t ? await run(t) : missing(id));
    }
    return out;
  };

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

    // Đề xuất: POST /api/topics/results/confirm { topicIds } → kết quả từng
    // đề tài. Backend phải tính lại trạng thái từ phiếu điểm, không tin client.
    confirmResults(ids) {
      return eachTopic(ids, (t) => {
        const why = confirmResultBlocker(t);
        if (why) return outcome(t, false, `Bỏ qua: ${why}`);
        t.status = 'Đã xác nhận';
        addHistory(
          t,
          'Trạng thái',
          'Xác nhận kết quả',
          `Đã xác nhận cho cả nhóm (${t.group.length} sinh viên). Điểm đã khóa.`,
        );
        return outcome(
          t,
          true,
          `Đã xác nhận kết quả cho cả nhóm (${t.group.length} sinh viên).`,
        );
      });
    },

    // Đề xuất: POST /api/topics/{id}/results/unconfirm { reason }.
    async unconfirmResult(id, reason) {
      const t = topics.find((x) => x.id === id);
      if (!t) return missing(id);
      const why = reason.trim();
      if (t.status !== 'Đã xác nhận')
        return outcome(
          t,
          false,
          t.status === 'Đã hoàn tất'
            ? 'Bỏ qua: đã công bố, không hủy xác nhận được.'
            : 'Bỏ qua: đề tài chưa ở trạng thái Đã xác nhận.',
        );
      if (!why) return outcome(t, false, 'Cần nhập lý do hủy xác nhận.');
      t.status = 'Đã cho điểm';
      addHistory(t, 'Trạng thái', 'Hủy xác nhận kết quả', `Lý do: ${why}`);
      return outcome(
        t,
        true,
        'Đã hủy xác nhận. Đề tài về Đã cho điểm, giảng viên sửa lại được phiếu.',
      );
    },

    // Đề xuất: POST /api/topics/results/publish { topicIds }.
    async publishResults(ids, on = today) {
      const closed = new Map<string, boolean>();
      return eachTopic(ids, async (t) => {
        if (!closed.has(t.roundId))
          closed.set(
            t.roundId,
            finalLockClosed(await rounds.get(t.roundId), on),
          );
        const why = publishResultBlocker(t, closed.get(t.roundId) ?? false);
        if (why) return outcome(t, false, `Bỏ qua: ${why}`);
        t.status = 'Đã hoàn tất';
        addHistory(t, 'Trạng thái', 'Công bố kết quả', 'Đã hoàn tất');
        return outcome(
          t,
          true,
          `Đã công bố cho cả nhóm (${t.group.length} sinh viên). Sinh viên đã nhận thông báo.`,
        );
      });
    },

    // Đề xuất: POST /api/topics/{id}/deviation-reminders { message }.
    remindDeviations(ids, message) {
      return eachTopic(ids, (t) => {
        const why = remindDeviationBlocker(t);
        if (why) return outcome(t, false, `Bỏ qua: ${why}`);
        const names = deviationRecipients(t);
        addHistory(
          t,
          'Điểm',
          'Gửi nhắc lệch điểm',
          `Gửi tới ${names.join(', ')}.${message?.trim() ? ` Nội dung: ${message.trim()}` : ''}`,
        );
        return outcome(t, true, `Đã gửi nhắc cho ${names.join(', ')}.`);
      });
    },
  };
}

export const topicService: TopicService = createTopicService();
