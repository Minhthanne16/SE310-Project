'use client';

import React, { useRef } from 'react';

export type WorkspaceTabKey =
  | 'tong-quan'
  | 'thong-bao'
  | 'hoat-dong'
  | 'diem-so';

export interface TabItem {
  key: WorkspaceTabKey;
  label: string;
  badge?: number;
}

interface WorkspaceTabsProps {
  activeTab: WorkspaceTabKey;
  onTabChange: (key: WorkspaceTabKey) => void;
  openRequestsCount?: number;
}

export const WORKSPACE_TABS: { key: WorkspaceTabKey; label: string }[] = [
  { key: 'tong-quan', label: 'Tổng quan đề tài' },
  { key: 'thong-bao', label: 'Thông báo' },
  { key: 'hoat-dong', label: 'Hoạt động' },
  { key: 'diem-so', label: 'Điểm số' },
];

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  activeTab,
  onTabChange,
  openRequestsCount = 0,
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % WORKSPACE_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = WORKSPACE_TABS.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = WORKSPACE_TABS[nextIndex];
    onTabChange(nextTab.key);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="wsp-tabs" role="tablist" aria-label="Các mục của không gian đề tài">
      {WORKSPACE_TABS.map((tab, idx) => {
        const isSelected = activeTab === tab.key;
        const count = tab.key === 'hoat-dong' ? openRequestsCount : 0;
        const ariaLabel =
          count > 0 ? `${tab.label}, ${count} việc cần xử lý` : tab.label;

        return (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={`wsp-tab-${tab.key}`}
            role="tab"
            aria-selected={isSelected}
            aria-controls={`wsp-tabpanel-${tab.key}`}
            aria-label={ariaLabel}
            tabIndex={isSelected ? 0 : -1}
            className="wsp-tab"
            onClick={() => onTabChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            <span>{tab.label}</span>
            {count > 0 && (
              <span className="wsp-tab-badge" aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
