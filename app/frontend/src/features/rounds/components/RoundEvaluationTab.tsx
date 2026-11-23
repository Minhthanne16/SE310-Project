'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import '@/features/rounds/rounds.css';
import {
  evaluationService as defaultEvaluationService,
  type EvaluationService,
} from '@/features/evaluations/services/evaluationService';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  type TopicService,
} from '@/features/topics/services/topicService';
import { GradingConfigSection } from '@/features/rounds/components/GradingConfigSection';
import { TemplateAssignmentSection } from '@/features/rounds/components/TemplateAssignmentSection';
import { ReviewerPanel } from '@/features/reviewers/components/ReviewerPanel';
import { CouncilPanel } from '@/features/councils/components/CouncilPanel';
import type { ReviewerService } from '@/features/reviewers/services/reviewerService';
import type { CouncilService } from '@/features/councils/services/councilService';
import type { Round } from '@/types/round';

export type EvalSectionKey =
  | 'cau-hinh-diem'
  | 'mau-phieu'
  | 'phan-bien'
  | 'hoi-dong';

interface RoundEvaluationTabProps {
  round: Round;
  roundService?: RoundService;
  topicService?: TopicService;
  evaluationService?: EvaluationService;
  reviewerService?: ReviewerService;
  councilService?: CouncilService;
  onChanged?: (round: Round) => void;
}

const SUB_TABS: { key: EvalSectionKey; label: string }[] = [
  { key: 'cau-hinh-diem', label: 'Cấu hình điểm' },
  { key: 'mau-phieu', label: 'Mẫu phiếu' },
  { key: 'phan-bien', label: 'Phản biện' },
  { key: 'hoi-dong', label: 'Hội đồng' },
];

export const RoundEvaluationTab: React.FC<RoundEvaluationTabProps> = ({
  round,
  roundService = defaultRoundService,
  evaluationService = defaultEvaluationService,
  reviewerService,
  councilService,
  onChanged = () => { },
}) => {
  const searchParams = useSearchParams();
  const initialMuc = (searchParams?.get('muc') as EvalSectionKey) || 'cau-hinh-diem';
  const [activeSection, setActiveSection] = useState<EvalSectionKey>(
    SUB_TABS.some((t) => t.key === initialMuc) ? initialMuc : 'cau-hinh-diem',
  );

  useEffect(() => {
    const muc = searchParams?.get('muc') as EvalSectionKey;
    if (muc && SUB_TABS.some((t) => t.key === muc)) {
      setActiveSection(muc);
    }
  }, [searchParams]);

  const selectSection = (key: EvalSectionKey) => {
    setActiveSection(key);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'danh-gia');
      url.searchParams.set('muc', key);
      window.history.replaceState(null, '', url.toString());
    }
  };

  return (
    <div className="rnd-panel" aria-label="Đánh giá khóa luận">
      <div
        className="rnd-eval-subtabs"
        role="tablist"
        aria-label="Các mục đánh giá"
      >
        {SUB_TABS.map((tab) => {
          const isSelected = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              id={`eval-subtab-${tab.key}`}
              aria-selected={isSelected}
              aria-controls={`eval-subpanel-${tab.key}`}
              className={`rnd-eval-subtab ${isSelected ? 'rnd-eval-subtab-active' : ''}`}
              onClick={() => selectSection(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`eval-subpanel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`eval-subtab-${activeSection}`}
        className="rnd-eval-subpanel"
      >
        {activeSection === 'cau-hinh-diem' && (
          <GradingConfigSection
            round={round}
            roundService={roundService}
            onChanged={onChanged}
          />
        )}

        {activeSection === 'mau-phieu' && (
          <TemplateAssignmentSection
            round={round}
            evaluationService={evaluationService}
          />
        )}

        {activeSection === 'phan-bien' && (
          <ReviewerPanel
            mode="edit"
            roundId={round.id}
            embedded={true}
            service={reviewerService}
          />
        )}

        {activeSection === 'hoi-dong' && (
          <CouncilPanel
            mode="edit"
            roundId={round.id}
            embedded={true}
            service={councilService}
          />
        )}
      </div>
    </div>
  );
};
