import { formatDate } from '@/features/rounds/roundUtils';
import type { Outline } from '@/types/outline';
import type { TopicSubmissions } from '@/types/submission';
import type { TopicDetailDto } from '@/types/topic';

export type StepKind = 'done' | 'now' | 'todo';

export interface ProgressStep {
  text: string;
  kind: StepKind;
}

export interface ProgressRow {
  key: 'registration' | 'outline' | 'midterm' | 'final' | 'evaluation' | 'result';
  label: string;
  steps: ProgressStep[];
  note?: string;
  parallel?: boolean;
}

export interface BuildProgressInput {
  topic: TopicDetailDto;
  outline: Outline | null;
  submissions: TopicSubmissions | null;
  today?: string;
}

const EVALUATION_SETTLED_STATUSES = [
  'Đã cho điểm',
  'Có lệch điểm',
  'Đã xác nhận',
  'Đã hoàn tất',
];

const CONFIRMED_SETTLED_STATUSES = ['Đã xác nhận', 'Đã hoàn tất'];

export function buildProgress(input: BuildProgressInput): ProgressRow[] {
  const { topic, outline, submissions } = input;

  // Đề tài không có nhóm: không vẽ tiến độ
  if (topic.status === 'Không có nhóm') {
    return [];
  }

  const rows: ProgressRow[] = [];

  // 1. ĐĂNG KÝ
  const isProposal = topic.source === 'SV đề xuất';
  const regStepText = isProposal
    ? 'Đề xuất được chấp nhận'
    : 'Đã ghi danh';
  const regDone = topic.group && topic.group.length > 0;
  rows.push({
    key: 'registration',
    label: 'ĐĂNG KÝ',
    steps: [
      {
        text: regStepText,
        kind: regDone ? 'done' : 'now',
      },
    ],
  });

  // 2. ĐỀ CƯƠNG
  const outlineSubmissions = outline?.submissions ?? [];
  const outlineApproved = Boolean(topic.outlineApprovedAt || outline?.approvedAt);
  const openRequests = (outline?.requests ?? []).filter((r) => r.status === 'open');

  if (outlineSubmissions.length === 0) {
    const deadlineNote = outline?.deadline
      ? `Hạn nộp ${formatDate(outline.deadline)}`
      : undefined;
    rows.push({
      key: 'outline',
      label: 'ĐỀ CƯƠNG',
      note: deadlineNote,
      steps: [
        {
          text: 'Chưa nộp',
          kind: 'now',
        },
      ],
    });
  } else {
    const step1: ProgressStep = {
      text: `Đã nộp · lần ${outlineSubmissions.length}`,
      kind: 'done',
    };
    let step2: ProgressStep;
    if (outlineApproved) {
      step2 = {
        text: 'GVHD đã duyệt',
        kind: 'done',
      };
    } else if (openRequests.length > 0) {
      step2 = {
        text: `Cần chỉnh sửa · ${openRequests.length} yêu cầu`,
        kind: 'now',
      };
    } else {
      step2 = {
        text: 'Chờ GVHD duyệt',
        kind: 'now',
      };
    }
    rows.push({
      key: 'outline',
      label: 'ĐỀ CƯƠNG',
      steps: [step1, step2],
    });
  }

  // 3. GIỮA KỲ
  const midterm = submissions?.kinds?.find((k) => k.kind === 'midterm');
  if (!outlineApproved) {
    rows.push({
      key: 'midterm',
      label: 'GIỮA KỲ',
      note: 'Mở sau khi đề cương được duyệt',
      steps: [{ text: 'Chưa mở', kind: 'todo' }],
    });
  } else {
    const versions = midterm?.versions ?? [];
    let step1: ProgressStep;
    let midtermNote: string | undefined;

    if (versions.length > 0) {
      const latest = versions[0];
      const lateText = latest.isLate ? ' · Nộp trễ' : '';
      step1 = {
        text: `Đã nộp · bản ${latest.version}${lateText}`,
        kind: 'done',
      };
    } else if (midterm?.window === 'closed') {
      step1 = {
        text: 'Chưa nộp · đã khóa nộp',
        kind: 'now',
      };
      if (midterm.deadline) {
        midtermNote = `Hạn nộp ${formatDate(midterm.deadline)}`;
      }
    } else if (midterm?.window === 'late') {
      step1 = {
        text: 'Quá hạn · cho nộp trễ',
        kind: 'now',
      };
      if (midterm.lateDeadline) {
        midtermNote = `Hạn trễ ${formatDate(midterm.lateDeadline)}`;
      }
    } else {
      step1 = {
        text: 'Chưa nộp',
        kind: 'now',
      };
      if (midterm?.deadline) {
        midtermNote = `Hạn nộp ${formatDate(midterm.deadline)}`;
      }
    }

    // Bước 2: GVHD nhận xét (A13)
    const step2: ProgressStep = {
      text: 'GVHD nhận xét',
      kind: 'todo',
    };

    rows.push({
      key: 'midterm',
      label: 'GIỮA KỲ',
      note: midtermNote,
      steps: [step1, step2],
    });
  }

  // 4. CUỐI KỲ
  const finalSub = submissions?.kinds?.find((k) => k.kind === 'final');
  if (!outlineApproved) {
    rows.push({
      key: 'final',
      label: 'CUỐI KỲ',
      note: 'Mở sau khi đề cương được duyệt',
      steps: [{ text: 'Chưa mở', kind: 'todo' }],
    });
  } else {
    const versions = finalSub?.versions ?? [];
    let step1: ProgressStep;
    let finalNote: string | undefined;

    if (versions.length > 0) {
      step1 = {
        text: `Đã nộp · ${versions.length} phiên bản`,
        kind: 'done',
      };
    } else if (finalSub?.window === 'closed') {
      step1 = {
        text: 'Chưa nộp · đã khóa nộp',
        kind: 'now',
      };
      if (finalSub.deadline) {
        finalNote = `Hạn nộp ${formatDate(finalSub.deadline)}`;
      }
    } else if (finalSub?.window === 'late') {
      step1 = {
        text: 'Quá hạn · cho nộp trễ',
        kind: 'now',
      };
      if (finalSub.lateDeadline) {
        finalNote = `Hạn trễ ${formatDate(finalSub.lateDeadline)}`;
      }
    } else {
      step1 = {
        text: 'Chưa nộp',
        kind: 'now',
      };
      if (finalSub?.deadline) {
        finalNote = `Hạn nộp ${formatDate(finalSub.deadline)}`;
      }
    }

    // Bước 2: Chốt bản cuối
    const step2: ProgressStep = {
      text: 'Chốt bản cuối',
      kind: 'todo',
    };

    rows.push({
      key: 'final',
      label: 'CUỐI KỲ',
      note: finalNote,
      steps: [step1, step2],
    });
  }

  // 5. ĐÁNH GIÁ
  const evalDone = EVALUATION_SETTLED_STATUSES.includes(topic.status);
  const evalKind: StepKind = evalDone ? 'done' : 'todo';
  rows.push({
    key: 'evaluation',
    label: 'ĐÁNH GIÁ',
    note: 'Chấm song song, không theo thứ tự',
    parallel: true,
    steps: [
      { text: 'Điểm hướng dẫn', kind: evalKind },
      { text: 'Điểm phản biện', kind: evalKind },
      { text: 'Điểm hội đồng', kind: evalKind },
    ],
  });

  // 6. KẾT QUẢ
  if (topic.status === 'Không đủ điều kiện công bố') {
    rows.push({
      key: 'result',
      label: 'KẾT QUẢ',
      steps: [
        {
          text: 'Không đủ điều kiện công bố',
          kind: 'now',
        },
      ],
    });
  } else {
    const isGraded = EVALUATION_SETTLED_STATUSES.includes(topic.status);
    const isConfirmed = CONFIRMED_SETTLED_STATUSES.includes(topic.status);
    const isCompleted = topic.status === 'Đã hoàn tất';

    rows.push({
      key: 'result',
      label: 'KẾT QUẢ',
      steps: [
        {
          text: 'Đã cho điểm',
          kind: isGraded ? 'done' : 'todo',
        },
        {
          text: 'Xác nhận kết quả',
          kind: isConfirmed ? 'done' : 'todo',
        },
        {
          text: 'Công bố · hoàn tất',
          kind: isCompleted ? 'done' : 'todo',
        },
      ],
    });
  }

  return rows;
}

export interface CurrentStageSummary {
  rowKey: string;
  stageLabel: string;
  waitingStepText: string;
  collapsedText: string;
}

const STAGE_NAME_MAP: Record<string, string> = {
  registration: 'Đăng ký',
  outline: 'Đề cương',
  midterm: 'Giữa kỳ',
  final: 'Cuối kỳ',
  evaluation: 'Đánh giá',
  result: 'Kết quả',
};

export function getCurrentStage(rows: ProgressRow[]): CurrentStageSummary | null {
  for (const row of rows) {
    const isRowDone = row.steps.every((s) => s.kind === 'done');
    if (!isRowDone) {
      const waitingStep = row.steps.find((s) => s.kind !== 'done') ?? row.steps[0];
      const stageName = STAGE_NAME_MAP[row.key] || row.label;
      return {
        rowKey: row.key,
        stageLabel: stageName,
        waitingStepText: waitingStep.text,
        collapsedText: `${stageName} · ${waitingStep.text}`,
      };
    }
  }
  return null;
}
