'use client';

import React from 'react';
import { WorkspacePage } from '@/features/workspace/components/WorkspacePage';
import type { OutlineService } from '@/features/outline/services/outlineService';

export interface TopicWorkspacePageProps {
  topicId: string;
  service?: OutlineService;
  embedded?: boolean;
}

export const TopicWorkspacePage: React.FC<TopicWorkspacePageProps> = ({
  topicId,
  service,
  embedded = false,
}) => {
  return (
    <WorkspacePage
      topicId={topicId}
      outlineService={service}
      embedded={embedded}
    />
  );
};
