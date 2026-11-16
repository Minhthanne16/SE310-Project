'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import '@/features/topics/topics.css';
import { nameKey } from '@/features/rounds/roundValidation';
import { formatDate } from '@/features/rounds/roundUtils';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  studentTopicService as defaultService,
  type StudentTopicService,
} from '@/features/topics/services/topicApiService';
import type { Round } from '@/types/round';
import type { MyRegistration, RoundTopicList } from '@/types/topic';

interface StudentTopicsPageProps {
  service?: StudentTopicService;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  // DESIGN · SV-DangKy-ChuaMo: chưa có đợt đăng ký / chưa có danh sách đề tài.
  | { kind: 'no-round' }
  | { kind: 'not-published'; round: Round }
  // mine = null khi không đọc được tình trạng nhóm (danh sách vẫn hiện).
  | { kind: 'list'; data: RoundTopicList; mine: MyRegistration | null };

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

// SV-DangKy (P03-S01, P03-S02): sinh viên chỉ thấy danh sách khi Giáo vụ đã công bố; dòng nào
// cũng mở được Chi tiết đề tài để ghi danh. Đề xuất đề tài (P03-S03) làm ở bước sau.

const memberNames = (mine: MyRegistration) =>
  (mine.group?.members ?? [])
    .map((m) => (m.representative ? `${m.name} (đại diện)` : m.name))
    .join(', ');

const MyGroupLine: React.FC<{ mine: MyRegistration | null }> = ({ mine }) => {
  if (!mine)
    return (
      <p className="tpc-note">
        Không đọc được tình trạng nhóm của bạn. Tải lại trang để thử lại.
      </p>
    );
  const closed = mine.registrationOpen ? '' : ' Đã hết thời gian đăng ký.';
  if (!mine.group)
    return (
      <p className="tpc-mygroup" aria-label="Nhóm của bạn">
        <span>
          <Users size={16} aria-hidden="true" />{' '}
          {mine.registrationOpen
            ? 'Bạn chưa có nhóm. Mở một đề tài còn trống để ghi danh; người ghi danh là đại diện nhóm.'
            : `Bạn chưa có nhóm.${closed}`}
        </span>
      </p>
    );
  const representative = mine.group.members.find((m) => m.representative);
  return (
    <p className="tpc-mygroup" aria-label="Nhóm của bạn">
      <span>
        <Users size={16} aria-hidden="true" />{' '}
        {mine.topic
          ? `Nhóm của bạn (${memberNames(mine)}) đang ghi danh ${mine.topic.code} · ${mine.topic.title}.${closed}`
          : `Nhóm của bạn (${memberNames(mine)}) chưa giữ đề tài nào; đại diện ${representative?.name ?? ''} ghi danh lại được đề tài còn trống.${closed}`}
      </span>
      {mine.topic && (
        <Link href={`/sv/dang-ky/${mine.topic.id}`} className="tpc-reg-link">
          Xem đề tài của nhóm
        </Link>
      )}
    </p>
  );
};
export const StudentTopicsPage: React.FC<StudentTopicsPageProps> = ({
  service = defaultService,
}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rounds = await service.listRounds();
        const round = rounds.find((r) => r.status === 'Đang diễn ra');
        if (cancelled) return;
        if (!round) return setState({ kind: 'no-round' });
        if (!round.topicsPublishedAt)
          return setState({ kind: 'not-published', round });
        const [data, mine] = await Promise.all([
          service.listPublished(round.id),
          service.myRegistration(round.id).catch(() => null),
        ]);
        if (!cancelled) setState({ kind: 'list', data, mine });
      } catch (err: unknown) {
        if (!cancelled)
          setState({
            kind: 'error',
            message: errorText(err, 'Không tải được danh sách đề tài.'),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service]);

  const items = useMemo(() => {
    if (state.kind !== 'list') return [];
    const keyword = nameKey(search);
    return state.data.items.filter(
      (t) =>
        !keyword ||
        nameKey(t.title).includes(keyword) ||
        nameKey(t.code).includes(keyword) ||
        nameKey(t.field).includes(keyword) ||
        nameKey(t.supervisor.name).includes(keyword),
    );
  }, [state, search]);

  const heading = (
    <div className="tpc-head">
      <div className="tpc-head-text">
        <h1>Đăng ký đề tài</h1>
        <p>
          Xem danh sách đề tài giảng viên đã gửi và Giáo vụ đã công bố cho đợt
          của bạn.
        </p>
      </div>
    </div>
  );

  if (state.kind === 'loading')
    return (
      <p role="status" className="app-muted">
        Đang tải danh sách đề tài...
      </p>
    );
  if (state.kind === 'error')
    return (
      <div className="tpc-page">
        {heading}
        <section className="status-state" role="alert">
          <h2>Không tải được danh sách đề tài</h2>
          <p>{state.message}</p>
        </section>
      </div>
    );
  if (state.kind === 'no-round')
    return (
      <div className="tpc-page">
        {heading}
        <section className="status-state app-empty">
          <h2>Chưa có đợt đăng ký</h2>
          <p>
            Bạn chưa thuộc đợt khóa luận nào đang diễn ra. Liên hệ Giáo vụ Khoa
            nếu bạn cần tham gia đợt.
          </p>
        </section>
      </div>
    );
  if (state.kind === 'not-published')
    return (
      <div className="tpc-page">
        {heading}
        <section className="status-state app-empty">
          <h2>Chưa có danh sách đề tài</h2>
          <p>
            Giáo vụ chưa công bố danh sách đề tài của {state.round.name}. Bạn sẽ
            nhận thông báo khi danh sách được công bố.
          </p>
        </section>
      </div>
    );

  const { round } = state.data;
  return (
    <div className="tpc-page">
      {heading}
      <p className="tpc-publish-line" role="status">
        {round.roundName}: danh sách công bố ngày{' '}
        {formatDate((round.topicsPublishedAt ?? '').slice(0, 10))}
        {round.registrationEnd
          ? `, đăng ký đến 23:59 ngày ${formatDate(round.registrationEnd)}.`
          : '.'}
      </p>
      <MyGroupLine mine={state.mine} />
      <p className="tpc-note">
        <span>
          Chưa thấy đề tài phù hợp? Đề xuất đề tài của riêng nhóm kèm giảng viên
          hướng dẫn ở trang{' '}
          <Link href="/sv/don-dang-ky">Đơn đăng ký của tôi</Link>.
        </span>
      </p>

      <div className="tpc-filters">
        <label className="tpc-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm đề tài"
            placeholder="Tìm theo mã, tên đề tài, lĩnh vực, giảng viên"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {items.length === 0 ? (
        <section className="status-state app-empty">
          <h2>
            {state.data.items.length === 0
              ? 'Đợt chưa có đề tài'
              : 'Không có đề tài phù hợp'}
          </h2>
          <p>
            {state.data.items.length === 0
              ? 'Danh sách đã công bố nhưng chưa có đề tài nào.'
              : 'Thử từ khóa khác.'}
          </p>
        </section>
      ) : (
        <div className="tpc-tablebox">
          <table
            className="tpc-table tpc-table-compact"
            aria-label="Danh sách đề tài"
          >
            <thead>
              <tr>
                <th scope="col">Đề tài</th>
                <th scope="col">GV hướng dẫn</th>
                <th scope="col">Lĩnh vực</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">
                  <span className="app-visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((topic) => (
                <tr key={topic.id}>
                  <td>
                    <details>
                      <summary className="tpc-cell-title">
                        <strong>{topic.title}</strong>
                        <span className="tpc-sub">{topic.code}</span>
                      </summary>
                      <dl className="tpc-topic-detail">
                        <dt>Mô tả</dt>
                        <dd>{topic.description}</dd>
                        <dt>Yêu cầu</dt>
                        <dd>
                          {topic.requirements || 'Không có yêu cầu riêng.'}
                        </dd>
                      </dl>
                    </details>
                  </td>
                  <td>{topic.supervisor.name}</td>
                  <td>{topic.field}</td>
                  <td>
                    <TopicStatusChip status={topic.status} />
                    {state.mine?.topic?.id === topic.id && (
                      <span className="tpc-rep">Nhóm bạn</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/sv/dang-ky/${topic.id}`}
                      className="tpc-btn tpc-btn-sm"
                      aria-label={`Xem chi tiết ${topic.code}`}
                    >
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
