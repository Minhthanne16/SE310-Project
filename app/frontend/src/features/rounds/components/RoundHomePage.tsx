'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StatusState } from '@/components/ui/StatusState';
import { useSession } from '@/features/auth/session/SessionProvider';
import { TopbarContent } from '@/features/navigation/components/TopbarSlot';
import { NoticeBoard } from '@/features/rounds/components/NoticeBoard';
import { RoundGantt } from '@/features/rounds/components/RoundGantt';
import {
  addDays,
  currentMilestone,
  currentWeek,
  deriveTasks,
  formatDate,
  milestoneProgress,
  roundSpan,
} from '@/features/rounds/roundUtils';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { useUrlParam } from '@/lib/useUrlParam';
import type { Round, RoundStatus, RoundTab } from '@/types/round';

interface RoundHomePageProps {
  roundService?: RoundService;
}

const STATUS_RANK: Record<RoundStatus, number> = {
  'Đang diễn ra': 0,
  Nháp: 1,
  'Đã kết thúc': 2,
};

const manageHref = (id: string, tab?: string) =>
  `/giao-vu/dot/${id}${tab ? `?tab=${tab}` : ''}`;

// Đợt đang diễn ra nhưng chưa có tuần hiện tại: trước hoặc sau khoảng các mốc.
function phaseText(round: Round, today: string): string {
  const span = roundSpan(round.milestones);
  if (!span) return 'Chưa đặt ngày cho các mốc';
  return today < span.start ? 'Chưa bắt đầu' : 'Đã qua mốc cuối';
}

// Dòng tuần dưới tên đợt: "Tuần 6/20 của đợt · 12/10 – 18/10/2026".
function weekLine(round: Round, today: string): string {
  const span = roundSpan(round.milestones);
  if (!span) return 'Chưa đặt ngày cho các mốc';
  if (round.status === 'Đã kết thúc') return 'Đợt đã kết thúc';
  if (round.status === 'Nháp')
    return `Đợt chưa bắt đầu · tuần 1 bắt đầu ${formatDate(span.start)}`;
  const week = currentWeek(round, today);
  if (week === null) return phaseText(round, today);
  const from = addDays(span.start, (week - 1) * 7);
  const to = addDays(from, 6);
  return `Tuần ${week}/${span.weeks} của đợt · ${formatDate(from).slice(0, 5)} – ${formatDate(to)}`;
}

// Tên đợt không lặp chương trình đã hiện ở nhãn trên thẻ.
const shortName = (round: Round) =>
  round.name.startsWith(`${round.program} · `)
    ? round.name.slice(round.program.length + 3)
    : round.name;

const STATUS_HINT: Record<RoundStatus, string> = {
  'Đang diễn ra': 'Đang diễn ra',
  Nháp: 'Nháp, GV và SV chưa thấy',
  'Đã kết thúc': 'Đã kết thúc',
};

const STATUS_CLASS: Record<RoundStatus, string> = {
  'Đang diễn ra': 'is-running',
  Nháp: 'is-draft',
  'Đã kết thúc': 'is-ended',
};

const TASK_KIND: Record<RoundTab, string> = {
  'cau-hinh': 'CẤU HÌNH',
  'giang-vien': 'GIẢNG VIÊN',
  'sinh-vien': 'SINH VIÊN',
  'tien-do': 'TIẾN ĐỘ',
};

const TASK_HINT: Record<RoundTab, string> = {
  'cau-hinh': 'Mở cấu hình đợt để xử lý.',
  'giang-vien': 'Mở danh sách giảng viên của đợt để xử lý.',
  'sinh-vien': 'Mở danh sách sinh viên của đợt để xử lý.',
  'tien-do': 'Mở tiến độ đợt để xử lý.',
};

interface RoundCardProps {
  round: Round;
  today: string;
  onOpen: () => void;
}

const RoundCard: React.FC<RoundCardProps> = ({ round, today, onOpen }) => {
  const milestone = currentMilestone(round, today);
  const tasks = deriveTasks(round, today).length;
  const progress = milestone ? milestoneProgress(milestone, today) : 0;
  const draft = round.status === 'Nháp';
  const needs = !draft && tasks > 0;
  const people = `${round.lecturerIds.length} giảng viên · ${round.studentIds.length} sinh viên`;
  return (
    <button
      type="button"
      className={`round-card${needs ? ' needs-action' : ''}`}
      aria-label={`Mở đợt ${round.program} ${shortName(round)}`}
      onClick={onOpen}
    >
      <span className="round-card-top">
        <span className="round-card-program">{round.program}</span>
        <span className={`round-card-status ${STATUS_CLASS[round.status]}`}>
          {round.status}
        </span>
      </span>
      <span className="round-card-title">
        <span className="round-card-name">{shortName(round)}</span>
        <span className="round-card-week">{weekLine(round, today)}</span>
      </span>
      {round.status === 'Đang diễn ra' && (
        <span className="round-card-progress">
          <span className="round-card-now">
            {milestone
              ? `${milestone.name} · hạn ${formatDate(milestone.endDate).slice(0, 5)}`
              : 'Chưa có mốc đang diễn ra'}
          </span>
          <span className="progress-bar" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        </span>
      )}
      <span className="round-card-foot">
        <span>{draft ? 'Đang cấu hình mốc và người tham gia' : people}</span>
        <span className={`round-card-need${needs ? ' is-needed' : ''}`}>
          <span className="round-card-dot" aria-hidden="true" />
          {draft
            ? 'Chưa mở đợt'
            : tasks > 0
              ? `${tasks} việc cần xử lý`
              : 'Không có việc cần xử lý'}
        </span>
      </span>
      <span className="round-card-open">
        Xem đợt
        <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
      </span>
    </button>
  );
};

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button type="button" className="home-back" onClick={onClick}>
    <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
    Tất cả đợt
  </button>
);

// Trang chủ Giáo vụ (docs/DESIGN/03, "Trang chủ"): danh sách thẻ mọi đợt (kể
// cả Nháp); bấm một thẻ vào chi tiết đợt với việc cần xử lý, Bảng thông báo,
// Gantt. Đợt đang xem giữ trong URL (?dot=id).
export const RoundHomePage: React.FC<RoundHomePageProps> = ({
  roundService = defaultRoundService,
}) => {
  const { session } = useSession();
  const [dotId, setDotId] = useUrlParam('dot');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Đổi giữa danh sách thẻ và chi tiết: chuyển tiêu điểm tới h1 của màn mới.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousDot = useRef(dotId);
  useEffect(() => {
    if (previousDot.current === dotId) return;
    previousDot.current = dotId;
    headingRef.current?.focus();
  }, [dotId, loading]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await roundService.list();
      setRounds(
        [...list].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]),
      );
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Không tải được danh sách đợt.',
      );
    } finally {
      setLoading(false);
    }
  }, [roundService]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = roundService.today;
  const selected = dotId ? rounds.find((r) => r.id === dotId) : undefined;
  const name = session.status === 'authenticated' ? session.user.fullName : '';

  if (loading)
    return (
      <p role="status" className="app-muted">
        Đang tải các đợt...
      </p>
    );

  if (loadError)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được danh sách</h2>
        <p>{loadError}</p>
        <button
          type="button"
          className="app-button"
          onClick={() => void load()}
        >
          Thử lại
        </button>
      </section>
    );

  if (dotId && !selected)
    return (
      <>
        <StatusState
          variant="notFound"
          title="Không tìm thấy đợt"
          description="Đợt không tồn tại hoặc đã bị xóa."
        />
        <div>
          <BackButton onClick={() => setDotId(null)} />
        </div>
      </>
    );

  if (selected) {
    const tasks = deriveTasks(selected, today);
    return (
      <>
        <TopbarContent>
          <BackButton onClick={() => setDotId(null)} />
          <span className="home-period">
            Đợt <span className="home-period-chip">{selected.name}</span>
          </span>
          <span className="home-period-hint">
            {STATUS_HINT[selected.status]}
          </span>
        </TopbarContent>

        <div className="app-page-heading">
          <div className="app-heading-row">
            <h1 ref={headingRef} tabIndex={-1}>
              Chào {name}
            </h1>
            <Link
              className="app-button"
              href={manageHref(selected.id)}
              aria-label={`Quản lý đợt ${selected.name}`}
            >
              Quản lý đợt
            </Link>
          </div>
          <p>{weekLine(selected, today)}</p>
        </div>

        <section aria-label="Việc sắp đến hạn">
          {tasks.length === 0 ? (
            <p className="app-muted">Không có việc nào cần xử lý.</p>
          ) : (
            <ul className="todo-grid">
              {tasks.map((t, index) => (
                <li key={t.id}>
                  <Link
                    className={`todo-card${index === 0 ? ' is-first' : ''}`}
                    href={manageHref(selected.id, t.tab)}
                  >
                    <span className="todo-card-top">
                      <span className="todo-card-kind">{TASK_KIND[t.tab]}</span>
                      <span className="todo-card-when">Cần xử lý</span>
                    </span>
                    <span className="todo-card-title">{t.text}</span>
                    <span className="todo-card-sub">{TASK_HINT[t.tab]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <NoticeBoard roundId={selected.id} roundService={roundService} />

        <section className="app-card" aria-labelledby="round-gantt-title">
          <div className="app-card-header">
            <h2 id="round-gantt-title">Tiến độ đợt</h2>
          </div>
          <RoundGantt
            round={selected}
            today={today}
            actionHref={() => manageHref(selected.id, 'cau-hinh')}
          />
        </section>
      </>
    );
  }

  const running = rounds.filter((r) => r.status === 'Đang diễn ra').length;
  const drafts = rounds.filter((r) => r.status === 'Nháp').length;
  const ended = rounds.length - running - drafts;
  const counts = [
    `${running} đang diễn ra`,
    `${drafts} nháp`,
    ...(ended > 0 ? [`${ended} đã kết thúc`] : []),
  ].join(', ');

  return (
    <>
      <div className="app-page-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          Chào {name}
        </h1>
        <p className="home-intro">
          Bạn quản lý {rounds.length} đợt khóa luận ({counts}). Chọn một đợt để
          xem việc cần làm, bảng thông báo và tiến độ của đợt đó.
        </p>
      </div>
      {rounds.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Chưa có đợt nào</h2>
          <p>Tạo đợt khóa luận đầu tiên để bắt đầu.</p>
          <Link className="status-state-action" href="/giao-vu/dot">
            Đến danh sách đợt
          </Link>
        </section>
      ) : (
        <section className="round-grid" aria-label="Các đợt khóa luận">
          {rounds.map((r) => (
            <RoundCard
              key={r.id}
              round={r}
              today={today}
              onOpen={() => setDotId(r.id)}
            />
          ))}
        </section>
      )}
      <p className="home-note">
        Đợt Nháp chỉ giáo vụ thấy. Giảng viên và sinh viên thấy đợt sau khi bạn
        mở đợt.
      </p>
    </>
  );
};
