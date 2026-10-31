import React from 'react';
import {
  TEMPLATE_STATE_LABEL,
  templateState,
  type EvaluationTemplate,
  type TemplateState,
} from '@/types/evaluation';

const STATE_CLASS: Record<TemplateState, string> = {
  draft: 'app-chip-pending',
  ready: 'app-chip-info',
  inuse: 'app-chip-active',
};

export const TemplateStateChip: React.FC<{
  template: Pick<EvaluationTemplate, 'status' | 'assignments'>;
}> = ({ template }) => {
  const state = templateState(template);
  return (
    <span className={`app-chip ${STATE_CLASS[state]}`}>
      {TEMPLATE_STATE_LABEL[state]}
    </span>
  );
};
