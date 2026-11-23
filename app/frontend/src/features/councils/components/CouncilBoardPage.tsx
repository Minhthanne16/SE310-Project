'use client';

import React from 'react';
import {
  CouncilPanel,
  type CouncilPanelProps,
} from '@/features/councils/components/CouncilPanel';

export const CouncilBoardPage: React.FC<CouncilPanelProps> = (props) => {
  return <CouncilPanel mode="view" embedded={false} {...props} />;
};
