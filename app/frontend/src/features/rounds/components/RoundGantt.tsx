import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import '@/features/rounds/rounds.css';
import {
  addDays,
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
  // Có heading = dựng đầy đủ như artboard GanttDot (tiêu đề, dòng tuần hiện
  // tại, chú giải bên phải); không có = chỉ chú giải và lưới để đặt trong thẻ
  // của trang chứa.
  heading?: string;
  footer?: string;
}

const LEGEND: { status: MilestoneStatus; swatch: string }[] = [
  { status: 'Đã qua', swatch: 'rnd-swatch-past' },
  { status: 'Đang diễn ra', swatch: 'rnd-swatch-now' },
  { status: 'Sắp tới', swatch: 'rnd-swatch-next' },
];
const BAR_CLASS: Record<MilestoneStatus, string> = {
  'Đã qua': 'rnd-bar-past',
  'Đang diễn ra': 'rnd-bar-now',
  'Sắp tới': 'rnd-bar-next',
};

const ddMM = (iso: string) => formatDate(iso).slice(0, 5);

// Gantt tuần của một đợt với 9 mốc (docs/DESIGN/03, "Gantt tiến độ đợt"; artboard
// GanttDot): cột T1..Tn, cột tuần hiện tại tô màu nhấn. Thanh bar chỉ để nhìn
// (aria-hidden); mỗi mốc là một mục danh sách có chữ mô tả ngày và trạng thái
// cho trình đọc màn hình.
export const RoundGantt: React.FC<RoundGanttProps> = ({
  round,
  today,
  actionHref,
  onAction,
  actionLabel = 'Cấu hình',
  heading,
  footer,
}) => {
  const span = roundSpan(round.milestones);
  if (!span) {
    return (
      <p className="rnd-gantt-empty" role="status">
        Chưa có mốc nào được đặt ngày nên chưa vẽ được biểu đồ.
      </p>
    );
  }
  const weeks = span.weeks;
  const now = currentWeek(round, today);

  const legend = (
    <ul className="rnd-gantt-legend" aria-label="Chú giải">
      {LEGEND.map((l) => (
        <li key={l.status}>
          <span className={`rnd-swatch ${l.swatch}`} aria-hidden />
          {l.status}
        </li>
      ))}
      <li>
        <span className="rnd-swatch rnd-swatch-week" aria-hidden />
        Tuần hiện tại
      </li>
    </ul>
  );

  const weekRange = (week: number) =>
    `${ddMM(addDays(span.start, (week - 1) * 7))} – ${ddMM(addDays(span.start, (week - 1) * 7 + 6))}`;
  const sub =
    round.status === 'Đã kết thúc'
      ? 'Đợt đã kết thúc · mọi mục đã qua.'
      : now !== null
        ? `Tuần ${now}/${weeks} · ${weekRange(now)}.`
        : round.status === 'Nháp'
          ? `Đợt chưa mở · tuần 1 bắt đầu ${formatDate(span.start)}.`
          : `Hôm nay nằm ngoài khoảng ${weeks} tuần của đợt.`;

  return (
    <div
      className="rnd-gantt"
      aria-label={`Tiến độ ${round.name}`}
      role="group"
    >
      {heading ? (
        <div className="rnd-gantt-top">
          <div>
            <h2>{heading}</h2>
            <p>{sub}</p>
          </div>
          {legend}
        </div>
      ) : (
        legend
      )}
      <div className="rnd-gantt-scroll">
        <div
          className="rnd-gantt-grid"
          style={
            {
              minWidth: 280 + weeks * 34,
              '--rnd-weeks': weeks,
            } as React.CSSProperties
          }
        >
          <div className="rnd-gantt-row rnd-gantt-head" aria-hidden="true">
            <span className="rnd-gantt-head-label">MỤC · THỜI GIAN</span>
            {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
              <span
                key={w}
                className={
                  w === now
                    ? 'rnd-gantt-week rnd-gantt-week-now'
                    : 'rnd-gantt-week'
                }
              >
                T{w}
                <small>{ddMM(addDays(span.start, (w - 1) * 7))}</small>
              </span>
            ))}
          </div>
          <ol className="rnd-gantt-list">
            {round.milestones.map((m) => {
              const status = milestoneStatus(m, today);
              const startWeek = m.startDate ? weekOf(span, m.startDate) : null;
              const endWeek = m.endDate ? weekOf(span, m.endDate) : null;
              const dated = startWeek !== null && endWeek !== null;
              const range = dated
                ? `${formatDate(m.startDate)} – ${formatDate(m.endDate)}`
                : 'Chưa đặt ngày';
              const weekText = dated
                ? `T${startWeek}${endWeek > startWeek ? `–${endWeek}` : ''}`
                : '';
              let barText = '';
              if (dated) {
                if (status === 'Đang diễn ra') {
                  const left = endWeek - (now ?? startWeek);
                  barText = left <= 0 ? 'Đến hạn' : `Còn ${left} tuần`;
                } else if (status === 'Đã qua') barText = 'Đã kết thúc';
                else if (endWeek > startWeek) barText = `Mở ${ddMM(m.startDate)}`;
              }
              const actionClass =
                status === 'Đang diễn ra'
                  ? 'rnd-gantt-action rnd-gantt-action-now'
                  : 'rnd-gantt-action';
              const actionName = `${actionLabel} mốc ${m.name}`;
              return (
                <li
                  key={m.key}
                  className="rnd-gantt-row rnd-gantt-row-body"
                >
                  <div className="rnd-gantt-label">
                    <span className="rnd-gantt-name">{m.name}</span>
                    <span className="app-visually-hidden">
                      {dated ? `: ${range}, ${status}.` : `: ${range}.`}
                    </span>
                    <span className="rnd-gantt-range" aria-hidden="true">
                      {dated
                        ? `${ddMM(m.startDate)} – ${ddMM(m.endDate)} · ${weekText}`
                        : range}
                    </span>
                    {actionHref && !onAction && (
                      <Link
                        className={actionClass}
                        href={actionHref(m.key)}
                        aria-label={actionName}
                      >
                        {actionLabel}
                        <ArrowRight size={13} strokeWidth={2.2} aria-hidden />
                      </Link>
                    )}
                    {onAction && (
                      <button
                        type="button"
                        className={actionClass}
                        aria-label={actionName}
                        onClick={() => onAction(m.key)}
                      >
                        {actionLabel}
                        <ArrowRight size={13} strokeWidth={2.2} aria-hidden />
                      </button>
                    )}
                  </div>
                  {now !== null && (
                    <span
                      className="rnd-gantt-now-col"
                      aria-hidden="true"
                      style={{ gridColumn: `${now + 1} / ${now + 2}` }}
                    />
                  )}
                  {dated && (
                    <span
                      className={`rnd-gantt-bar ${BAR_CLASS[status]}`}
                      aria-hidden="true"
                      title={`${m.name}: ${range} (${status})`}
                      style={{
                        gridColumn: `${startWeek + 1} / ${endWeek + 2}`,
                      }}
                    >
                      {barText}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {footer && <p className="rnd-gantt-foot">{footer}</p>}
    </div>
  );
};
