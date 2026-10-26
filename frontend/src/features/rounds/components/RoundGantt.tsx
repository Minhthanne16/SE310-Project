import React from 'react';
import Link from 'next/link';
import {
  currentWeek,
  formatDate,
  milestoneStatus,
  roundSpan,
  weekOf,
} from '@/features/rounds/roundUtils';
import type { MilestoneStatus, Round } from '@/types/round';

interface RoundGanttProps {
  round: Round;
  // "Hôm nay" (yyyy-MM-dd), lấy từ roundService.today.
  today: string;
  // Có giá trị = hiện nút thao tác theo từng mốc (giáo vụ: mọi mốc).
  actionHref?: (milestoneKey: string) => string;
  // Thay cho actionHref khi thao tác diễn ra ngay trên trang (ví dụ đổi tab).
  onAction?: (milestoneKey: string) => void;
  actionLabel?: string;
}

const LEGEND: MilestoneStatus[] = ['Đã qua', 'Đang diễn ra', 'Sắp tới'];
const BAR_CLASS: Record<MilestoneStatus, string> = {
  'Đã qua': 'gantt-bar-past',
  'Đang diễn ra': 'gantt-bar-now',
  'Sắp tới': 'gantt-bar-next',
};

// Gantt tuần của một đợt với 9 mốc (docs/DESIGN/03, "Gantt tiến độ đợt"): cột
// T1..Tn, cột tuần hiện tại tô màu nhấn. Thanh bar chỉ để nhìn (aria-hidden);
// mỗi mốc là một mục danh sách có chữ mô tả ngày và trạng thái cho trình đọc màn hình.
export const RoundGantt: React.FC<RoundGanttProps> = ({
  round,
  today,
  actionHref,
  onAction,
  actionLabel = 'Cấu hình',
}) => {
  const span = roundSpan(round.milestones);
  if (!span) {
    return (
      <p className="app-muted" role="status">
        Chưa có mốc nào được đặt ngày nên chưa vẽ được biểu đồ.
      </p>
    );
  }
  const weeks = span.weeks;
  const now = currentWeek(round, today);
  const cell = (week: number) => ({
    left: `${((week - 1) / weeks) * 100}%`,
    width: `${100 / weeks}%`,
  });

  return (
    <div className="gantt" aria-label={`Tiến độ ${round.name}`} role="group">
      <ul className="gantt-legend" aria-label="Chú giải">
        {LEGEND.map((s) => (
          <li key={s}>
            <span className={`gantt-swatch ${BAR_CLASS[s]}`} aria-hidden />
            {s}
          </li>
        ))}
        <li>
          <span className="gantt-swatch gantt-swatch-week" aria-hidden />
          Tuần hiện tại
        </li>
      </ul>
      <div className="gantt-scroll">
        <div className="gantt-grid" style={{ minWidth: 220 + weeks * 34 }}>
          <div className="gantt-row gantt-head" aria-hidden="true">
            <div className="gantt-label" />
            <div className="gantt-track">
              {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
                <span
                  key={w}
                  className={
                    w === now ? 'gantt-week gantt-week-now' : 'gantt-week'
                  }
                  style={cell(w)}
                >
                  T{w}
                </span>
              ))}
            </div>
          </div>
          <ol className="gantt-list">
            {round.milestones.map((m) => {
              const status = milestoneStatus(m, today);
              const startWeek = m.startDate ? weekOf(span, m.startDate) : null;
              const endWeek = m.endDate ? weekOf(span, m.endDate) : null;
              const dated = startWeek !== null && endWeek !== null;
              const range = dated
                ? `${formatDate(m.startDate)} – ${formatDate(m.endDate)}`
                : 'Chưa đặt ngày';
              return (
                <li key={m.key} className="gantt-row">
                  <div className="gantt-label">
                    <span className="gantt-name">{m.name}</span>
                    <span className="app-visually-hidden">
                      {`: ${range}, ${status}.`}
                    </span>
                    {actionHref && !onAction && (
                      <Link
                        className="gantt-action"
                        href={actionHref(m.key)}
                        aria-label={`${actionLabel} mốc ${m.name}`}
                      >
                        {actionLabel}
                      </Link>
                    )}
                    {onAction && (
                      <button
                        type="button"
                        className="gantt-action"
                        aria-label={`${actionLabel} mốc ${m.name}`}
                        onClick={() => onAction(m.key)}
                      >
                        {actionLabel}
                      </button>
                    )}
                  </div>
                  <div className="gantt-track" aria-hidden="true">
                    {now && (
                      <span className="gantt-now-col" style={cell(now)} />
                    )}
                    {startWeek !== null && endWeek !== null && (
                      <span
                        className={`gantt-bar ${BAR_CLASS[status]}`}
                        title={`${m.name}: ${range} (${status})`}
                        style={{
                          left: `${((startWeek - 1) / weeks) * 100}%`,
                          width: `${((endWeek - startWeek + 1) / weeks) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
};
