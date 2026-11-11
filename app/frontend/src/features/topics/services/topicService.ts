import { createApiTopicService } from '@/features/topics/services/topicApiService';
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

// Ứng dụng luôn dùng API thật (topicApiService.ts). Kho trong bộ nhớ dành cho
// test nằm ở topicDemoService.ts và được truyền vào component qua prop.
export const topicService: TopicService = createApiTopicService();
