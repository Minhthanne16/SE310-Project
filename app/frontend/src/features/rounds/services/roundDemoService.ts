import {
  nameKey,
  normalizeRoundInput,
  validateRoundInput,
} from '@/features/rounds/roundValidation';
import {
  finishBlockedMessage,
  openBlockers,
  publishBlocker,
  validateMilestones,
} from '@/features/rounds/roundUtils';
import {
  DEMO_TODAY,
  buildMilestones,
  seedNotifications,
  seedParticipants,
  seedRounds,
} from '@/features/rounds/services/roundSeed';
import {
  DuplicateRoundNameError,
  MilestoneOrderError,
  RoundNotFoundError,
  RoundRuleError,
  RoundValidationError,
  type RoundService,
} from '@/features/rounds/services/roundService';
import type {
  LecturerRolePreviewError,
  LecturerRolePreviewItem,
  OverviewStatistics,
  AttentionAlert,
  ParticipantCheck,
  ParticipantKind,
  Round,
  RoundLecturerRole,
} from '@/types/round';
import { TOPIC_STATUSES } from '@/types/round';

const cloneRound = (round: Round): Round => ({
  ...round,
  milestones: round.milestones.map((m) => ({ ...m })),
  lecturerIds: [...round.lecturerIds],
  studentIds: [...round.studentIds],
  lockedStudentIds: [...round.lockedStudentIds],
  lockedLecturerIds: [...(round.lockedLecturerIds ?? [])],
  topicSummary: {
    ...round.topicSummary,
    byStatus: { ...round.topicSummary.byStatus },
    pendingTopics: round.topicSummary.pendingTopics?.map((topic) => ({
      ...topic,
    })),
  },
});

const idsOf = (round: Round, kind: ParticipantKind) =>
  kind === 'student' ? round.studentIds : round.lecturerIds;

const KIND_LABEL: Record<ParticipantKind, string> = {
  lecturer: 'giảng viên',
  student: 'sinh viên',
};

const emptyTopics = (): Round['topicSummary'] => ({
  total: 0,
  pendingResultCount: 0,
  byStatus: Object.fromEntries(
    TOPIC_STATUSES.map((s) => [s, 0]),
  ) as Round['topicSummary']['byStatus'],
});

interface RoundServiceOptions {
  today?: string;
  // Dữ liệu đợt ban đầu (test); mặc định là bộ mẫu.
  rounds?: Round[];
}

// Kho trong bộ nhớ CHỈ DÀNH CHO TEST: cùng interface với API thật
// (roundApiService.ts) để test component không cần backend. Ứng dụng không
// dùng kho này.
export function createRoundService(
  options: RoundServiceOptions = {},
): RoundService {
  const today = options.today ?? DEMO_TODAY;
  const users = seedParticipants();
  let rounds = options.rounds ?? seedRounds();
  const notifications = seedNotifications();
  let nextId = rounds.length + 1;

  const find = (id: string): Round => {
    const round = rounds.find((r) => r.id === id);
    if (!round) throw new RoundNotFoundError();
    return round;
  };

  const save = (next: Round): Round => {
    rounds = rounds.map((r) => (r.id === next.id ? next : r));
    return cloneRound(next);
  };

  // Một sinh viên chỉ thuộc một đợt đang diễn ra.
  const runningRoundOf = (studentId: string, exceptId: string) =>
    rounds.find(
      (r) =>
        r.id !== exceptId &&
        r.status === 'Đang diễn ra' &&
        r.studentIds.includes(studentId),
    );

  // Quy tắc "một đợt đang diễn ra" áp dụng khi đợt đích đang diễn ra; với đợt
  // Nháp chỉ kiểm tra lúc mở đợt.
  const conflictingRound = (
    round: Round,
    kind: ParticipantKind,
    studentId: string,
  ) =>
    kind === 'student' && round.status === 'Đang diễn ra'
      ? runningRoundOf(studentId, round.id)
      : undefined;

  const check = (
    round: Round,
    kind: ParticipantKind,
    codes: string[],
  ): ParticipantCheck[] => {
    // Mỗi mục là mã hoặc email (không phân biệt hoa thường). Mục trùng và
    // cùng một người nhập bằng mã rồi email chỉ tính một lần.
    const seen = new Set<string>();
    const seenUsers = new Set<string>();
    const results: ParticipantCheck[] = [];
    for (const raw of codes) {
      const code = raw.trim();
      if (!code || seen.has(code.toLowerCase())) continue;
      seen.add(code.toLowerCase());
      const key = code.toLowerCase();
      const participant = users[kind].find(
        (u) => u.code.toLowerCase() === key || u.email.toLowerCase() === key,
      );
      if (participant) {
        if (seenUsers.has(participant.id)) continue;
        seenUsers.add(participant.id);
      }
      if (!participant) {
        results.push({
          code,
          status: 'notFound',
          message: `Không tồn tại ${KIND_LABEL[kind]} có mã hoặc email này.`,
        });
      } else if (idsOf(round, kind).includes(participant.id)) {
        results.push({
          code,
          status: 'alreadyInRound',
          message: 'Đã có trong đợt này.',
          participant,
        });
      } else {
        const other = conflictingRound(round, kind, participant.id);
        results.push(
          other
            ? {
                code,
                status: 'inOtherRound',
                message: `Đang thuộc đợt “${other.name}”. Một sinh viên chỉ ở một đợt đang diễn ra.`,
                participant,
              }
            : {
                code,
                status: 'valid',
                message: 'Hợp lệ.',
                participant,
              },
        );
      }
    }
    return results;
  };

  const assertEditable = (round: Round) => {
    if (round.status === 'Đã kết thúc')
      throw new RoundRuleError('Đợt đã kết thúc nên không sửa được nữa.');
  };

  return {
    today,

    // Đề xuất: GET /api/rounds?status=&program=&search= → ApiResponse<RoundDto[]>
    // (phân trang phía máy chủ khi dữ liệu lớn). Giáo vụ thấy cả đợt Nháp.
    async list(filters = {}) {
      const keyword = nameKey(filters.search ?? '');
      return rounds
        .filter(
          (r) =>
            (!filters.status ||
              filters.status === 'Tất cả' ||
              r.status === filters.status) &&
            (!filters.program || r.program === filters.program) &&
            (!keyword || nameKey(r.name).includes(keyword)),
        )
        .map(cloneRound);
    },

    // Đề xuất: GET /api/rounds/{id} → RoundDto; 404 khi không có.
    async get(id) {
      return cloneRound(find(id));
    },

    // Đề xuất: POST /api/rounds { name, program, periodLabel, copyFromId? }
    // → 201 RoundDto (trạng thái Nháp); 400 thiếu thông tin; 409 trùng tên đợt.
    // Sao chép từ đợt cũ (PDR-034): chỉ giữ khung 9 mốc ("Thông báo cho",
    // "Cho nộp trễ"); không sao chép ngày (ngày của đợt cũ đã qua nên dễ gây
    // lệch thứ tự), giảng viên hay sinh viên.
    async create(raw) {
      const fields = validateRoundInput(raw);
      if (Object.keys(fields).length > 0)
        throw new RoundValidationError(fields);
      const input = normalizeRoundInput(raw);
      if (rounds.some((r) => nameKey(r.name) === nameKey(input.name)))
        throw new DuplicateRoundNameError();

      const source = input.copyFromId ? find(input.copyFromId) : undefined;
      const blank = buildMilestones([]);
      const round: Round = {
        id: `r-${nextId++}`,
        name: input.name,
        program: input.program as Round['program'],
        periodLabel: input.periodLabel,
        status: 'Nháp',
        lecturerLoadMin: source?.lecturerLoadMin ?? 0,
        lecturerLoadMax: source?.lecturerLoadMax ?? 0,
        maxGroupSize: source?.maxGroupSize ?? 2,
        grading: source?.grading ?? {
          weightChair: 1,
          weightSecretary: 1,
          weightSupervisor: 2,
          weightReviewer: 2,
          deviationThreshold: 2,
        },
        topicsPublishedAt: null,
        milestones: source
          ? blank.map((m) => {
              const old = source.milestones.find((o) => o.key === m.key);
              return old
                ? {
                    ...m,
                    notifyAudience: old.notifyAudience,
                    allowLate: m.allowLate === null ? null : old.allowLate,
                  }
                : m;
            })
          : blank,
        lecturerIds: [],
        studentIds: [],
        lockedStudentIds: [],
        lockedLecturerIds: [],
        topicSummary: emptyTopics(),
      };
      rounds = [round, ...rounds];
      return cloneRound(round);
    },

    // PUT /api/rounds/{id} { name, program, periodLabel, lecturerLoadMin?,
    // lecturerLoadMax? } → RoundDto; chỉ đợt
    // Nháp (409 khi đã mở); 400 thiếu thông tin; 409 trùng tên đợt khác.
    async update(id, raw) {
      const round = find(id);
      if (round.status !== 'Nháp')
        throw new RoundRuleError(
          'Đợt đã mở nên không sửa thông tin đợt được nữa.',
        );
      const fields = validateRoundInput(raw);
      if (Object.keys(fields).length > 0)
        throw new RoundValidationError(fields);
      const input = normalizeRoundInput(raw);
      if (
        rounds.some(
          (r) => r.id !== id && nameKey(r.name) === nameKey(input.name),
        )
      )
        throw new DuplicateRoundNameError();
      return save({
        ...round,
        name: input.name,
        program: input.program as Round['program'],
        periodLabel: input.periodLabel,
        lecturerLoadMin: raw.lecturerLoadMin ?? round.lecturerLoadMin,
        lecturerLoadMax: raw.lecturerLoadMax ?? round.lecturerLoadMax,
        maxGroupSize: raw.maxGroupSize ?? round.maxGroupSize,
      });
    },

    // Đề xuất: POST /api/rounds/{id}/open → RoundDto; 409 khi không phải Nháp,
    // còn mốc thiếu hoặc sai ngày (PDR-032, chặn) hoặc có sinh viên đang ở đợt
    // đang diễn ra khác. Thiếu giảng viên, sinh viên chỉ cảnh báo ở giao diện
    // (PDR-033). Máy chủ gửi thông báo cho giảng viên và sinh viên của đợt.
    async open(id) {
      const round = find(id);
      if (round.status !== 'Nháp')
        throw new RoundRuleError('Chỉ mở được đợt Nháp.');
      const blockers = openBlockers(round);
      if (blockers.length > 0)
        throw new RoundRuleError(`Chưa mở được đợt: ${blockers.join('; ')}.`);
      const conflicts = round.studentIds.filter((s) =>
        runningRoundOf(s, round.id),
      );
      if (conflicts.length > 0) {
        const names = conflicts.map((s) => {
          const person = users.student.find((u) => u.id === s);
          return person ? `${person.code} (${person.name})` : s;
        });
        throw new RoundRuleError(
          `Không mở được đợt: sinh viên ${names.join(', ')} đang thuộc đợt đang diễn ra khác.`,
        );
      }
      return save({ ...round, status: 'Đang diễn ra' });
    },

    // POST /api/rounds/{id}/finish → RoundDto; 409 khi không phải
    // Đang diễn ra hoặc còn đề tài chưa ở trạng thái kết thúc (PDR-031; đề tài
    // Không có nhóm không tính).
    async finish(id) {
      const round = find(id);
      if (round.status !== 'Đang diễn ra')
        throw new RoundRuleError('Chỉ kết thúc được đợt đang diễn ra.');
      const blocked = finishBlockedMessage(round);
      if (blocked) throw new RoundRuleError(blocked);
      return save({ ...round, status: 'Đã kết thúc' });
    },

    // Đề xuất: DELETE /api/rounds/{id} → 204; 409 khi không phải Nháp.
    async remove(id) {
      const round = find(id);
      if (round.status !== 'Nháp')
        throw new RoundRuleError('Chỉ xóa được đợt Nháp.');
      rounds = rounds.filter((r) => r.id !== id);
    },

    // Đề xuất: PUT /api/rounds/{id}/milestones { milestones: MilestoneDto[9] }
    // → RoundDto; 400 kèm lỗi theo mốc khi sai thứ tự.
    async updateMilestones(id, milestones) {
      const round = find(id);
      assertEditable(round);
      const errors = validateMilestones(milestones);
      if (Object.keys(errors).length > 0) throw new MilestoneOrderError(errors);
      return save({
        ...round,
        // Giữ tên và thứ tự 9 mốc cố định; chỉ nhận phần cấu hình.
        milestones: round.milestones.map((m) => {
          const next = milestones.find((x) => x.key === m.key);
          return next
            ? {
                ...m,
                startDate: next.startDate.trim(),
                endDate: next.endDate.trim(),
                notifyAudience: next.notifyAudience,
                allowLate: m.allowLate === null ? null : !!next.allowLate,
                lateEndDate:
                  m.allowLate === null
                    ? undefined
                    : (next.lateEndDate ?? '').trim(),
              }
            : m;
        }),
      });
    },

    async saveGrading(id, input) {
      const round = find(id);
      if (round.status !== 'Nháp') {
        throw new RoundRuleError('Đợt đã mở, không sửa cấu hình điểm.');
      }
      return save({
        ...round,
        grading: {
          weightChair: input.weightChair,
          weightSecretary: input.weightSecretary,
          weightSupervisor: input.weightSupervisor,
          weightReviewer: input.weightReviewer,
          deviationThreshold: input.deviationThreshold,
        },
      });
    },

    // Đề xuất: GET /api/users?role=Lecturer|Student (đã có thể dùng chung với
    // màn Người dùng khi backend có endpoint danh sách).
    async listParticipants(kind) {
      return users[kind].map((u) => ({ ...u }));
    },

    // Đề xuất: GET /api/rounds/{id}/lecturers|students/candidates → người chưa
    // thuộc đợt, kèm lý do không chọn được.
    async listCandidates(id, kind) {
      const round = find(id);
      const inRound = new Set(idsOf(round, kind));
      return users[kind]
        .filter((u) => !inRound.has(u.id))
        .map((u) => {
          const other = conflictingRound(round, kind, u.id);
          return other
            ? { ...u, blockedReason: `Đang ở đợt “${other.name}”` }
            : { ...u };
        });
    },

    // Đề xuất: POST /api/rounds/{id}/lecturers|students/check { codes }
    // → kết quả từng mã (không ghi).
    async checkParticipants(id, kind, codes) {
      const round = find(id);
      assertEditable(round);
      return check(round, kind, codes);
    },

    // Đề xuất: POST /api/rounds/{id}/lecturers|students { codes }
    // → { results, added }. Chỉ thêm mã hợp lệ; mã còn lại trả lý do.
    async addParticipants(id, kind, codes, roles) {
      const round = find(id);
      assertEditable(round);
      const results = check(round, kind, codes);
      const valid = results.filter(
        (r) => r.status === 'valid' && r.participant,
      );
      const next = cloneRound(round);
      for (const r of valid) {
        idsOf(next, kind).push(r.participant!.id);
        if (kind === 'lecturer') {
          if (!next.lecturerRoles) next.lecturerRoles = [];
          next.lecturerRoles.push({
            userId: r.participant!.id,
            code: r.participant!.code,
            name: r.participant!.name,
            email: r.participant!.email,
            unit: r.participant!.unit,
            isSupervisor: roles?.isSupervisor ?? true,
            isReviewer: roles?.isReviewer ?? false,
            isCommittee: roles?.isCommittee ?? false,
          });
        }
      }
      return { round: save(next), results, added: valid.length };
    },

    // Đề xuất: DELETE /api/rounds/{id}/lecturers|students/{userId} → RoundDto;
    // 409 khi sinh viên đã có dữ liệu trong đợt (đề tài, điểm...); không có trạng thái
    // "Ngừng tham gia".
    async removeParticipant(id, kind, userId) {
      const round = find(id);
      assertEditable(round);
      const participant = users[kind].find((u) => u.id === userId);
      if (!participant || !idsOf(round, kind).includes(userId))
        throw new RoundRuleError(`Không có ${KIND_LABEL[kind]} này trong đợt.`);
      if (
        (kind === 'student'
          ? round.lockedStudentIds
          : (round.lockedLecturerIds ?? [])
        ).includes(userId)
      )
        throw new RoundRuleError(
          `Không gỡ được ${participant.name}: đã có dữ liệu (đề tài, điểm...) trong đợt này.`,
        );
      const next = cloneRound(round);
      if (kind === 'student')
        next.studentIds = next.studentIds.filter((x) => x !== userId);
      else {
        next.lecturerIds = next.lecturerIds.filter((x) => x !== userId);
        if (next.lecturerRoles) {
          next.lecturerRoles = next.lecturerRoles.filter((r) => r.userId !== userId);
        }
      }
      return save(next);
    },

    async updateLecturerRoles(id, userId, roles) {
      const round = find(id);
      assertEditable(round);
      if (!roles.isSupervisor && !roles.isReviewer && !roles.isCommittee) {
        throw new RoundRuleError('Phải chọn ít nhất một vai trò cho giảng viên.');
      }
      const next = cloneRound(round);
      if (!next.lecturerRoles) next.lecturerRoles = [];
      const existing = next.lecturerRoles.find((r) => r.userId === userId);
      if (existing) {
        existing.isSupervisor = roles.isSupervisor;
        existing.isReviewer = roles.isReviewer;
        existing.isCommittee = roles.isCommittee;
      } else {
        const u = users.lecturer.find((x) => x.id === userId);
        if (u) {
          next.lecturerRoles.push({
            userId: u.id,
            code: u.code,
            name: u.name,
            email: u.email,
            unit: u.unit,
            isSupervisor: roles.isSupervisor,
            isReviewer: roles.isReviewer,
            isCommittee: roles.isCommittee,
          });
        }
      }
      return save(next);
    },

    async previewLecturerRoles(id, rows) {
      const round = find(id);
      assertEditable(round);
      const valid: LecturerRolePreviewItem[] = [];
      const errors: LecturerRolePreviewError[] = [];
      for (const r of rows) {
        const code = r.code.trim();
        if (!code) continue;
        const u = users.lecturer.find(
          (x) =>
            x.code.toLowerCase() === code.toLowerCase() ||
            x.email.toLowerCase() === code.toLowerCase(),
        );
        if (!u) {
          errors.push({
            code,
            reason: 'Không tìm thấy giảng viên trong hệ thống.',
          });
          continue;
        }
        if (!r.isSupervisor && !r.isReviewer && !r.isCommittee) {
          errors.push({ code, reason: 'Không có vai trò nào được chọn.' });
          continue;
        }
        const isNew = !round.lecturerIds.includes(u.id);
        valid.push({
          userId: u.id,
          code: u.code,
          name: u.name,
          email: u.email,
          unit: u.unit,
          isSupervisor: r.isSupervisor,
          isReviewer: r.isReviewer,
          isCommittee: r.isCommittee,
          isNew,
        });
      }
      return { valid, errors };
    },

    async importLecturerRoles(id, rows) {
      const preview = await this.previewLecturerRoles(id, rows);
      const round = find(id);
      assertEditable(round);
      const next = cloneRound(round);
      if (!next.lecturerRoles) next.lecturerRoles = [];
      for (const v of preview.valid) {
        if (v.isNew) {
          next.lecturerIds.push(v.userId);
        }
        const idx = next.lecturerRoles.findIndex((r) => r.userId === v.userId);
        const roleObj: RoundLecturerRole = {
          userId: v.userId,
          code: v.code,
          name: v.name,
          email: v.email,
          unit: v.unit,
          isSupervisor: v.isSupervisor,
          isReviewer: v.isReviewer,
          isCommittee: v.isCommittee,
        };
        if (idx >= 0) next.lecturerRoles[idx] = roleObj;
        else next.lecturerRoles.push(roleObj);
      }
      return save(next);
    },

    // POST /api/rounds/{id}/topics/publish → RoundDto; 404 không có đợt; 409
    // khi không Đang diễn ra, đã công bố, hoặc đã hết hạn đăng ký. Không bị
    // chặn bởi hạn "GV gửi đề tài". Backend thật chưa có bảng đề tài nên chưa
    // kiểm tra "ít nhất 1 đề tài"; kho demo kiểm tra theo topicSummary.
    async markTopicsPublished(id) {
      const round = find(id);
      const blocked = publishBlocker(round, today);
      if (blocked) throw new RoundRuleError(blocked);
      return save({ ...round, topicsPublishedAt: `${today}T08:00:00.000Z` });
    },

    // Đề xuất: GET /api/notifications?roundId=&source=all|giaovu|mine&search=&limit=
    // → { items, total }, mới nhất trước. Bảng thông báo không có trả lời và
    // không có số người đã xem.
    async listNotifications(query) {
      const keyword = nameKey(query.search ?? '');
      const items = notifications
        .filter(
          (n) =>
            n.roundId === query.roundId &&
            (!query.source ||
              query.source === 'all' ||
              (query.source === 'giaovu' && n.source === 'Từ giáo vụ') ||
              (query.source === 'mine' && n.mine)) &&
            (!keyword ||
              nameKey(n.title).includes(keyword) ||
              nameKey(n.sender).includes(keyword)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        items: items
          .slice(0, query.limit ?? items.length)
          .map((n) => ({ ...n })),
        total: items.length,
      };
    },

    async getOverview(): Promise<OverviewStatistics> {
      const list = rounds.map((r) => {
        const summary = r.topicSummary;
        const byStatus = summary?.byStatus;
        const registered = byStatus?.['Đã đăng ký'] ?? 0;
        const inProgress = byStatus?.['Đang thực hiện'] ?? 0;
        const scoring =
          (byStatus?.['Đang cho điểm'] ?? 0) +
          (byStatus?.['Đã cho điểm'] ?? 0) +
          (byStatus?.['Có lệch điểm'] ?? 0);
        const settled =
          (byStatus?.['Đã xác nhận'] ?? 0) + (byStatus?.['Đã hoàn tất'] ?? 0);
        const withGroup = registered + inProgress + scoring + settled;
        const currentM = r.milestones.find(
          (m) => m.startDate <= today && m.endDate >= today,
        );
        return {
          roundId: r.id,
          name: r.name,
          status: r.status,
          currentMilestoneKey: currentM?.key ?? null,
          topicCount: summary?.total ?? 0,
          studentsWithGroup: withGroup,
          studentCount: r.studentIds.length,
          topicsWithReviewer: inProgress + scoring + settled,
          topicsScored: null,
          topicsWithDeviation: null,
        };
      });

      const alerts: AttentionAlert[] = [];
      for (const r of rounds) {
        if (r.status === 'Đang diễn ra') {
          const registered = r.topicSummary?.byStatus?.['Đã đăng ký'] ?? 0;
          const missingReg = r.studentIds.length - registered;
          if (missingReg > 0) {
            alerts.push({
              kind: 'StudentsWithoutGroup',
              roundId: r.id,
              roundName: r.name,
              count: missingReg,
              target: `/giao-vu/dot/${r.id}?tab=sinh-vien`,
              message: `${missingReg} sinh viên chưa có nhóm`,
            });
          }
        }
      }

      return { rounds: list, alerts };
    },
  };
}
