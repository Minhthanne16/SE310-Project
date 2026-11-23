'use client';

import React from 'react';
import {
  ReviewerPanel,
  type ReviewerPanelProps,
} from '@/features/reviewers/components/ReviewerPanel';

export const ReviewerAssignmentPage: React.FC<ReviewerPanelProps> = ({
  mode = 'edit',
  ...props
}) => {
  return <ReviewerPanel mode={mode} embedded={false} {...props} />;
};
