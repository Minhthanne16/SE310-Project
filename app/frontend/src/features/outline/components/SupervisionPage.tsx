'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '@/features/topics/topics.css';
import '@/features/outline/outline.css';
import { formatDateTime } from '@/features/rounds/roundUtils';
import {
  lecturerTopicService as defaultService,
  type LecturerTopicService,
} from '@/features/topics/services/topicApiService';
import type { Round } from '@/types/round';
import type { LecturerTopicList, TopicDto } from '@/types/topic';

// /gv/huong-dan: nhóm GV đang hướng dẫn (DESIGN/03 "Nhóm hướng dẫn"). Hiện có cột Đề cương
// và việc cần làm của chặng Đề cương (P04-S01); cột Khóa luận thêm khi có API nộp bài sau.
interface SupervisionPageProps {
  service?: Pick<LecturerTopicService, 'listRounds' | 'listMine'>;
}

type Filter = 'all' | 'todo';

interface Row {
  topic: TopicDto;
  outline: { text: string; chip: string };
  todo: string;
  needsAction: boolean;
}

export function supervisionRow(topic: TopicDto): Row {
  const s = topic.outline;
  if (topic.outlineApprovedAt)
    return {
      topic,
      outline: {
        text: `Đã duyệt ${formatDateTime(topic.outlineApprovedAt).slice(0, 5)}`,
        chip: 'app-chip-active',
      },
      todo: 'Không có việc ở chặng Đề cương',
      needsAction: false,
    };
  if (!s || s.versions === 0)
    return {
      topic,
      outline: { text: 'Chưa nộp', chip: 'app-chip-disabled' },
      todo: 'Chờ nhóm nộp đề cương',
      needsAction: false,
    };
  if (s.awaitingReview)
    return {
      topic,
      outline: {
        text: `Chờ GVHD xem · ${s.versions} phiên bản`,
        chip: 'app-chip-info',
      },
      todo:
        s.openRequests > 0
          ? `Kiểm tra bản nộp lại, đóng ${s.openRequests} yêu cầu rồi duyệt`
          : 'Nhận xét, tạo yêu cầu chỉnh sửa hoặc duyệt',
      needsAction: true,
    };
  return {
    topic,
    outline: {
      text: `Chờ nhóm sửa · ${s.openRequests} yêu cầu mở`,
      chip: 'app-chip-pending',
    },
    todo: 'Chờ nhóm nộp phiên bản mới',
    needsAction: false,
  };
}

export const SupervisionPage: React.FC<SupervisionPageProps> = ({
  service = defaultService,
}) => {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [roundId, setRoundId] = useState('');
  const [data, setData] = useState<LecturerTopicList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let cancelled = false;
    service
      .listRounds()
      .then((list) => {
        if (cancelled) return;
        const visible = list.filter((r) => r.status !== 'Nháp');
        setRounds(visible);
        setRoundId(
          (visible.find((r) => r.status === 'Đang diễn ra') ?? visible[0])
            ?.id ?? '',
        );
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được đợt.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  const load = useCallback(
    async (id: string) => {
      try {
        setError(null);
        setData(await service.listMine(id));
      } catch (err: unknown) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Không tải được nhóm hướng dẫn.',
        );
      }
    },
    [service],
  );

  useEffect(() => {
    if (roundId) void load(roundId);
  }, [roundId, load]);

  const current = data && data.round.roundId === roundId ? data : null;
  const rows = useMemo(
    () =>
      current
        ? current.items.filter((t) => t.group.length > 0).map(supervisionRow)
        : [],
    [current],
  );
  const todo = rows.filter((r) => r.needsAction).length;
  const shown = filter === 'todo' ? rows.filter((r) => r.needsAction) : rows;

  if (error && !current)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được nhóm hướng dẫn</h2>
        <p>{error}</p>
      </section>
    );
  if (rounds === null)
    return (
      <p role="status" className="app-muted">
        Đang tải nhóm hướng dẫn…
      </p>
    );

  return (
    <div className="otl-page">
      {rounds.length > 0 && (
        <div className="tpc-round-row">
          <label htmlFor="hd-round">Đợt</label>
          <select
            id="hd-round"
            className="tpc-select"
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="app-page-heading">
        <h1>Nhóm hướng dẫn</h1>
        <p>
          Nhóm đang làm đề tài bạn hướng dẫn. Mở một nhóm để xem đề cương, tạo
          yêu cầu chỉnh sửa và duyệt.
        </p>
      </div>

      {rounds.length === 0 || (current && rows.length === 0) ? (
        <section className="status-state app-empty">
          <h2>Chưa có nhóm</h2>
          <p>Chưa có nhóm nào nhận đề tài bạn hướng dẫn trong đợt này.</p>
        </section>
      ) : !current ? (
        <p role="status" className="app-muted">
          Đang tải nhóm hướng dẫn…
        </p>
      ) : (
        <>
          <div className="app-segmented" role="group" aria-label="Lọc nhóm">
            <button
              type="button"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              {`Tất cả (${rows.length})`}
            </button>
            <button
              type="button"
              aria-pressed={filter === 'todo'}
              onClick={() => setFilter('todo')}
            >
              {`Cần xử lý (${todo})`}
            </button>
          </div>
          {shown.length === 0 ? (
            <p className="app-muted">Không có nhóm nào cần bạn xử lý.</p>
          ) : (
            <div className="app-table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th scope="col">Mã</th>
                    <th scope="col">Đề tài</th>
                    <th scope="col">Nhóm</th>
                    <th scope="col">Đề cương</th>
                    <th scope="col">Việc cần làm</th>
                    <th scope="col">
                      <span className="app-visually-hidden">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ topic, outline, todo: action }) => (
                    <tr key={topic.id}>
                      <td className="otl-nowrap">{topic.code}</td>
                      <td>{topic.title}</td>
                      <td>
                        {topic.group
                          .map((m) => `${m.name} (${m.code})`)
                          .join(', ')}
                      </td>
                      <td>
                        <span className={`app-chip ${outline.chip}`}>
                          {outline.text}
                        </span>
                      </td>
                      <td className="otl-todo">{action}</td>
                      <td>
                        <Link
                          href={`/de-tai/${encodeURIComponent(topic.id)}`}
                          className="app-button app-button-small"
                          aria-label={`Mở ${topic.code} ${topic.title}`}
                        >
                          Mở
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
