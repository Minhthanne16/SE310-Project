'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OutlineSection } from '@/features/outline/components/OutlineSection';
import { formatDate } from '@/features/rounds/roundUtils';
import { SubmissionPanel } from '@/features/submissions/components/SubmissionPanel';
import type { Outline } from '@/types/outline';
import type { SubmissionService } from '@/features/submissions/services/submissionApiService';
import type { OutlineService } from '@/features/outline/services/outlineService';
import type { TopicSubmissions } from '@/types/submission';
import type { TopicDetailDto } from '@/types/topic';

interface ActivityTabProps {
  topic: TopicDetailDto;
  outline: Outline | null;
  submissions: TopicSubmissions | null;
  submissionsError?: string | null;
  outlineService?: OutlineService;
  submissionService?: SubmissionService;
  onOutlineReady?: (outline: Outline) => void;
  onSubmissionsChanged?: (submissions: TopicSubmissions) => void;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({
  topic,
  outline,
  submissions,
  submissionsError,
  outlineService,
  submissionService,
  onOutlineReady,
  onSubmissionsChanged,
}) => {
  const outlineApproved = Boolean(topic.outlineApprovedAt || outline?.approvedAt);

  // Mặc định mở khối của chặng hiện tại
  const [openOutline, setOpenOutline] = useState(!outlineApproved);
  const [openMidterm, setOpenMidterm] = useState(
    outlineApproved &&
      (!submissions ||
        (submissions.kinds?.find((k) => k.kind === 'midterm')?.versions.length ??
          0) === 0),
  );
  const [openFinal, setOpenFinal] = useState(
    outlineApproved &&
      Boolean(
        submissions?.kinds?.find((k) => k.kind === 'midterm')?.versions
          .length,
      ) &&
      (!submissions?.kinds?.find((k) => k.kind === 'final')?.versions.length),
  );

  const outlineContentId = useId();
  const midtermContentId = useId();
  const finalContentId = useId();

  // Chip Đề cương
  const outlineOpenRequests = (outline?.requests ?? []).filter(
    (r) => r.status === 'open',
  ).length;
  let outlineChipText = 'Chưa nộp';
  let outlineChipClass = 'app-chip-disabled';
  if (outlineApproved) {
    outlineChipText = 'Đã duyệt';
    outlineChipClass = 'app-chip-active';
  } else if ((outline?.submissions ?? []).length > 0) {
    if (outlineOpenRequests > 0) {
      outlineChipText = 'Cần chỉnh sửa';
      outlineChipClass = 'app-chip-pending';
    } else {
      outlineChipText = 'Chờ duyệt';
      outlineChipClass = 'app-chip-info';
    }
  }

  // Chip Giữa kỳ
  const midterm = submissions?.kinds.find((k) => k.kind === 'midterm');
  const midtermOpenRequests = (midterm?.requests ?? []).filter(
    (r) => r.status === 'open',
  ).length;
  let midtermChipText = 'Chưa mở';
  let midtermChipClass = 'app-chip-disabled';
  if (outlineApproved) {
    const vCount = midterm?.versions.length ?? 0;
    if (midtermOpenRequests > 0) {
      midtermChipText = `Cần chỉnh sửa · ${midtermOpenRequests} yêu cầu`;
      midtermChipClass = 'app-chip-pending';
    } else if (vCount > 0) {
      midtermChipText = `Đã nộp · ${vCount} phiên bản`;
      midtermChipClass = 'app-chip-active';
    } else if (midterm?.window === 'closed') {
      midtermChipText = 'Đã khóa nộp';
      midtermChipClass = 'app-chip-disabled';
    } else if (midterm?.window === 'late') {
      midtermChipText = 'Quá hạn · cho nộp trễ';
      midtermChipClass = 'app-chip-pending';
    } else {
      midtermChipText = 'Chưa nộp';
      midtermChipClass = 'app-chip-disabled';
    }
  }

  // Chip Cuối kỳ
  const finalSub = submissions?.kinds.find((k) => k.kind === 'final');
  const finalOpenRequests = (finalSub?.requests ?? []).filter(
    (r) => r.status === 'open',
  ).length;
  let finalChipText = 'Chưa mở';
  let finalChipClass = 'app-chip-disabled';
  if (outlineApproved) {
    const vCount = finalSub?.versions.length ?? 0;
    if (finalOpenRequests > 0) {
      finalChipText = `Cần chỉnh sửa · ${finalOpenRequests} yêu cầu`;
      finalChipClass = 'app-chip-pending';
    } else if (vCount > 0) {
      finalChipText = `Đã nộp · ${vCount} phiên bản`;
      finalChipClass = 'app-chip-active';
    } else if (finalSub?.window === 'closed') {
      finalChipText = 'Đã khóa nộp';
      finalChipClass = 'app-chip-disabled';
    } else if (finalSub?.window === 'late') {
      finalChipText = 'Quá hạn · cho nộp trễ';
      finalChipClass = 'app-chip-pending';
    } else {
      finalChipText = 'Chưa nộp';
      finalChipClass = 'app-chip-disabled';
    }
  }

  return (
    <div
      id="wsp-tabpanel-hoat-dong"
      role="tabpanel"
      aria-labelledby="wsp-tab-hoat-dong"
    >
      {submissionsError && (
        <aside className="app-banner wsp-activity-banner" role="note">
          <p>{submissionsError}</p>
        </aside>
      )}

      {/* 1. Đề cương */}
      <section className="app-card wsp-activity-accordion">
        <button
          type="button"
          className="wsp-accordion-header"
          aria-expanded={openOutline}
          aria-controls={outlineContentId}
          onClick={() => setOpenOutline((prev) => !prev)}
        >
          <div className="wsp-accordion-header-left">
            <h2 className="wsp-accordion-title">Đề cương</h2>
            <span className={`app-chip ${outlineChipClass}`}>
              {outlineChipText}
            </span>
          </div>
          {openOutline ? (
            <ChevronUp size={18} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" />
          )}
        </button>
        {openOutline && (
          <div id={outlineContentId} className="wsp-accordion-content">
            <OutlineSection
              topicId={topic.id}
              service={outlineService}
              onReady={onOutlineReady}
            />
          </div>
        )}
      </section>

      {/* 2. Báo cáo giữa kỳ */}
      <section className="app-card wsp-activity-accordion">
        <button
          type="button"
          className="wsp-accordion-header"
          aria-expanded={openMidterm}
          aria-controls={midtermContentId}
          onClick={() => setOpenMidterm((prev) => !prev)}
        >
          <div className="wsp-accordion-header-left">
            <h2 className="wsp-accordion-title">Báo cáo giữa kỳ</h2>
            <span className={`app-chip ${midtermChipClass}`}>
              {midtermChipText}
            </span>
          </div>
          {openMidterm ? (
            <ChevronUp size={18} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" />
          )}
        </button>
        {openMidterm && (
          <div id={midtermContentId} className="wsp-accordion-content">
            {!outlineApproved ? (
              <p className="wsp-locked-message">
                Mục nộp báo cáo giữa kỳ mở sau khi giảng viên hướng dẫn duyệt đề
                cương.
                {midterm?.deadline
                  ? ` Thời gian nộp theo đợt: hạn ${formatDate(midterm.deadline)}.`
                  : ''}
              </p>
            ) : (
              <SubmissionPanel
                topicId={topic.id}
                kind="midterm"
                data={submissions ?? undefined}
                service={submissionService}
                onSubmitted={onSubmissionsChanged}
              />
            )}
          </div>
        )}
      </section>

      {/* 3. Báo cáo cuối kỳ · khóa luận */}
      <section className="app-card wsp-activity-accordion">
        <button
          type="button"
          className="wsp-accordion-header"
          aria-expanded={openFinal}
          aria-controls={finalContentId}
          onClick={() => setOpenFinal((prev) => !prev)}
        >
          <div className="wsp-accordion-header-left">
            <h2 className="wsp-accordion-title">
              Báo cáo cuối kỳ · khóa luận
            </h2>
            <span className={`app-chip ${finalChipClass}`}>
              {finalChipText}
            </span>
          </div>
          {openFinal ? (
            <ChevronUp size={18} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" />
          )}
        </button>
        {openFinal && (
          <div id={finalContentId} className="wsp-accordion-content">
            {!outlineApproved ? (
              <p className="wsp-locked-message">
                Mục nộp báo cáo cuối kỳ mở sau khi giảng viên hướng dẫn duyệt đề
                cương.
                {finalSub?.deadline
                  ? ` Thời gian nộp theo đợt: hạn ${formatDate(finalSub.deadline)}.`
                  : ''}
              </p>
            ) : (
              <SubmissionPanel
                topicId={topic.id}
                kind="final"
                data={submissions ?? undefined}
                service={submissionService}
                onSubmitted={onSubmissionsChanged}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
};
