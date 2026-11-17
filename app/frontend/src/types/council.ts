import type { TopicMember, TopicPerson } from '@/types/topic';

// Hợp đồng /api/councils (P06, PDR-063). Ngày yyyy-MM-dd, giờ HH:mm (giờ Việt Nam).

export type CouncilStatus = 'Nháp' | 'Đã công bố' | 'Đã hủy';

export interface CouncilRound {
  id: string;
  name: string;
  status: string;
  // Mốc 7 "Lịch bảo vệ"; chỉ để gợi ý ngày, không chặn.
  defenseStart: string;
  defenseEnd: string;
}

export interface CouncilSlot {
  id: string;
  order: number;
  topicId: string;
  code: string;
  title: string;
  group: TopicMember[];
  supervisor: TopicPerson;
  reviewer: TopicPerson | null;
  start: string;
  end: string;
  thesisVersionCount: number;
  finalLocked: boolean;
  status: 'active' | 'removed' | 'cancelled';
}

export interface CouncilLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  reason: string | null;
  detail: string | null;
}

export interface CouncilCorrection {
  at: string;
  by: string;
  content: string;
  reason: string | null;
}

export interface Council {
  id: string;
  roundId: string;
  name: string;
  status: CouncilStatus;
  version: number;
  chair: TopicPerson;
  secretary: TopicPerson;
  date: string;
  room: string;
  publishedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  // Đã có phiếu điểm hội đồng: khóa sửa giờ/phòng/thành viên và hủy (PDR-018/019/020).
  scored: boolean;
  slots: CouncilSlot[];
  conflicts: string[];
  corrections: CouncilCorrection[];
  history: CouncilLog[];
  canEdit: boolean;
  editBlockedReason: string | null;
  canDelete: boolean;
  canPublish: boolean;
  publishBlockedReason: string | null;
  canCancel: boolean;
  canCorrect: boolean;
}

export interface CouncilPoolTopic {
  topicId: string;
  code: string;
  title: string;
  group: TopicMember[];
  supervisor: TopicPerson;
  reviewer: TopicPerson | null;
  thesisVersionCount: number;
  eligible: boolean;
  blockedReason: string | null;
}

export interface CouncilLecturer {
  id: string;
  code: string;
  name: string;
}

export interface CouncilStats {
  councils: number;
  total: number;
  scheduled: number;
  unscheduled: number;
  conflicts: number;
}

export interface CouncilBoard {
  round: CouncilRound;
  councils: Council[];
  pool: CouncilPoolTopic[];
  lecturers: CouncilLecturer[];
  stats: CouncilStats;
}

export interface CouncilSlotInput {
  topicId: string;
  start: string;
  end: string;
}

export interface CouncilInput {
  roundId: string;
  name: string;
  chairId: string;
  secretaryId: string;
  date: string;
  room: string;
  slots: CouncilSlotInput[];
  // Khi sửa: phiên bản đang xem; lý do bắt buộc với lịch đã công bố.
  expectedVersion?: number;
  reason?: string;
}

export interface CouncilCheckResult {
  ok: boolean;
  problems: string[];
}

export interface CouncilPublishItem {
  councilId: string;
  name: string;
  ok: boolean;
  message: string;
}

export interface CouncilPublishResult {
  published: number;
  skipped: number;
  results: CouncilPublishItem[];
}

export interface MyCouncil {
  id: string;
  roundId: string;
  name: string;
  status: CouncilStatus;
  myRole: 'chair' | 'secretary';
  chair: TopicPerson;
  secretary: TopicPerson;
  date: string;
  room: string;
  cancelReason: string | null;
  slots: CouncilSlot[];
  corrections: CouncilCorrection[];
}

export interface MyCouncils {
  rounds: CouncilRound[];
  roundId: string | null;
  councils: MyCouncil[];
}
