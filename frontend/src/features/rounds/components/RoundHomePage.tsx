'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { StatusState } from '@/components/common/StatusState';
import { useSession } from '@/features/auth/session/SessionProvider';
import { NoticeBoard } from '@/features/rounds/components/NoticeBoard';
import {
  ProgramChip,
  RoundStatusChip,
} from '@/features/rounds/components/RoundChips';
import { RoundGantt } from '@/features/rounds/components/RoundGantt';
import {
  currentMilestone,
  currentWeek,
  deriveTasks,
  milestoneProgress,
} from '@/features/rounds/roundUtils';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { useUrlParam } from '@/lib/useUrlParam';
import type { Round, RoundStatus } from '@/types/round';

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

interface RoundCardProps {
  round: Round;
  today: string;
  onOpen: () => void;
}

const RoundCard: React.FC<RoundCardProps> = ({ round, today, onOpen }) => {
  const milestone = currentMilestone(round, today);
  const week = currentWeek(round, today);
  const tasks = deriveTasks(round, today).length;
  const progress = milestone ? milestoneProgress(milestone, today) : 0;
  return (
    <article className="app-card round-card">
      <div className="app-chip-row">
        <ProgramChip program={round.program} />
        <RoundStatusChip status={round.status} />
      </div>
      <h2>
        <button type="button" className="round-card-link" onClick={onOpen}>
          {round.name}
        </button>
      </h2>
      <p className="app-muted">
        {round.status === 'Đang diễn ra' && week !== null
          ? `Tuần ${week}`
          : round.status === 'Nháp'
            ? 'Chưa mở đợt'
            : round.status === 'Đã kết thúc'
              ? 'Đã kết thúc'
              : 'Chưa bắt đầu'}
      </p>
      {round.status === 'Đang diễn ra' && (
        <div className="round-card-progress">
          <span>{milestone ? milestone.name : 'Chưa có mốc đang diễn ra'}</span>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label={`Tiến độ mốc hiện tại của ${round.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <p className="round-card-tasks">
        {tasks > 0 ? `${tasks} việc cần xử lý` : 'Không có việc cần xử lý'}
      </p>
    </article>
  );
};

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
          <button
            type="button"
            className="app-button"
            onClick={() => setDotId(null)}
          >
            ← Tất cả đợt
          </button>
        </div>
      </>
    );

  if (selected) {
    const tasks = deriveTasks(selected, today);
    const week = currentWeek(selected, today);
    return (
      <>
        <div>
          <button
            type="button"
            className="app-button app-button-small"
            onClick={() => setDotId(null)}
          >
            ← Tất cả đợt
          </button>
        </div>
        <div className="app-page-heading">
          <div className="app-heading-row">
            <h1>{selected.name}</h1>
            <Link
              className="app-button"
              href={manageHref(selected.id)}
              aria-label={`Quản lý đợt ${selected.name}`}
            >
              Quản lý đợt
            </Link>
          </div>
          <div className="app-chip-row">
            <ProgramChip program={selected.program} />
            <RoundStatusChip status={selected.status} />
            {week !== null && selected.status === 'Đang diễn ra' && (
              <span className="app-muted">Tuần {week}</span>
            )}
          </div>
        </div>

        <section className="app-card" aria-labelledby="round-tasks-title">
          <div className="app-card-header">
            <h2 id="round-tasks-title">Việc cần xử lý</h2>
          </div>
          {tasks.length === 0 ? (
            <p className="app-muted">Không có việc nào cần xử lý.</p>
          ) : (
            <ul className="task-list">
              {tasks.map((t) => (
                <li key={t.id}>
                  <ListChecks size={16} aria-hidden="true" />
                  <span>{t.text}</span>
                  <Link
                    className="app-link"
                    href={manageHref(selected.id, t.tab)}
                  >
                    Xử lý
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

  return (
    <>
      <div className="app-page-heading">
        <h1>Xin chào, {name}</h1>
        <p>Các đợt khóa luận và việc cần xử lý. Bấm một đợt để xem chi tiết.</p>
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
        <div className="round-grid">
          {rounds.map((r) => (
            <RoundCard
              key={r.id}
              round={r}
              today={today}
              onOpen={() => setDotId(r.id)}
            />
          ))}
        </div>
      )}
    </>
  );
};
