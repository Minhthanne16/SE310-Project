'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  type ProgressRow,
  getCurrentStage,
} from '@/features/workspace/workspaceProgress';

interface ProgressPanelProps {
  rows: ProgressRow[];
  noGroup?: boolean;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({
  rows,
  noGroup = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentId = useId();

  if (noGroup) {
    return (
      <section className="app-card wsp-progress-card">
        <div role="note" className="wsp-no-group-note">
          Đề tài không có nhóm sau hạn đăng ký.
        </div>
      </section>
    );
  }

  const currentStage = getCurrentStage(rows);

  return (
    <section className="app-card wsp-progress-card" aria-label="Tiến độ thực hiện đề tài">
      <div className="wsp-progress-header">
        <h2 className="wsp-progress-title">TIẾN ĐỘ</h2>
        <button
          type="button"
          className="wsp-progress-toggle"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? (
            <>
              Thu gọn <ChevronUp size={16} aria-hidden="true" />
            </>
          ) : (
            <>
              Mở rộng <ChevronDown size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <div id={contentId}>
        {isExpanded ? (
          <div className="wsp-progress-rows">
            {rows.map((row) => (
              <div key={row.key} className="wsp-progress-row">
                <span className="wsp-progress-row-label">{row.label}</span>
                <div className="wsp-progress-row-steps">
                  {row.steps.map((step, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && !row.parallel && (
                        <div className="wsp-step-connector" aria-hidden="true" />
                      )}
                      <span className={`wsp-step wsp-step--${step.kind}`}>
                        <span className="wsp-step-dot" aria-hidden="true" />
                        {step.text}
                      </span>
                    </React.Fragment>
                  ))}
                  {row.note && <span className="wsp-step-note">({row.note})</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="wsp-progress-collapsed">
            {rows.map((row) => {
              const isCurrent = currentStage?.rowKey === row.key;
              const isRowDone = row.steps.every((s) => s.kind === 'done');
              const kind = isRowDone ? 'done' : isCurrent ? 'now' : 'todo';
              const text = isCurrent ? currentStage.collapsedText : row.label;

              return (
                <span key={row.key} className={`wsp-step wsp-step--${kind}`}>
                  <span className="wsp-step-dot" aria-hidden="true" />
                  {text}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
