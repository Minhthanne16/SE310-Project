'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Info } from 'lucide-react';
import '@/features/topics/topics.css';
import '@/features/rounds/rounds.css';
import { useSession } from '@/features/auth/session/SessionProvider';
import { RoundModal } from '@/features/rounds/components/RoundModal';
import { formatDate, formatDateTime } from '@/features/rounds/roundUtils';
import { TopicStatusChip } from '@/features/topics/components/TopicChips';
import {
  RegistrationError,
  studentTopicService as defaultService,
  type StudentTopicService,
} from '@/features/topics/services/topicApiService';
import { TopicNotFoundError } from '@/features/topics/services/topicService';
import type {
  MyRegistration,
  RegistrationHistoryItem,
  TopicDetailDto,
  TopicMember,
} from '@/types/topic';

interface StudentTopicDetailPageProps {
  topicId: string;
  // Id tài khoản đang đăng nhập, để biết mình có là đại diện nhóm không.
  viewerId: string;
  service?: StudentTopicService;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; topic: TopicDetailDto; mine: MyRegistration };

const LIST_HREF = '/sv/dang-ky';

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const MemberList: React.FC<{ members: TopicMember[] }> = ({ members }) => (
  <ul className="tpc-members" aria-label="Thành viên nhóm">
    {members.map((m) => (
      <li key={m.id}>
        <strong>{m.name}</strong>
        <span className="tpc-sub">{`${m.code} · ${m.className || 'Chưa có lớp'}`}</span>
        {m.representative && <span className="tpc-rep">Đại diện</span>}
      </li>
    ))}
  </ul>
);

const HistoryList: React.FC<{ items: RegistrationHistoryItem[] }> = ({
  items,
}) => (
  <section className="tpc-reg-card" aria-labelledby="reg-history-title">
    <h2 id="reg-history-title">Lịch sử ghi danh của nhóm</h2>
    <ul className="tpc-reg-history" aria-label="Lịch sử ghi danh">
      {items.map((h) => (
        <li key={`${h.topicId}-${h.registeredAt}`}>
          <Link href={`${LIST_HREF}/${h.topicId}`} className="tpc-reg-link">
            {`${h.topicCode} · ${h.topicTitle}`}
          </Link>
          <span>{`Ghi danh ${formatDateTime(h.registeredAt)} bởi ${h.registeredBy}`}</span>
          <span className={h.cancelledAt ? 'tpc-sub' : 'tpc-reg-active'}>
            {h.cancelledAt
              ? `Đã hủy ${formatDateTime(h.cancelledAt)} bởi ${h.cancelledBy ?? ''}`
              : 'Đang hiệu lực'}
          </span>
        </li>
      ))}
    </ul>
  </section>
);

// SV-ChiTietDeTai (P03-S02): xem đề tài, ghi danh (người bấm là đại diện, PDR-054) và hủy ghi
// danh cho cả nhóm (bất kỳ thành viên nào, PDR-047). Mọi quy tắc được máy chủ kiểm lại; màn hình
// chỉ chọn trạng thái hiển thị và luôn tải lại sau lỗi tranh chấp.
export const StudentTopicDetailPage: React.FC<StudentTopicDetailPageProps> = ({
  topicId,
  viewerId,
  service = defaultService,
}) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [memberCode, setMemberCode] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'register' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const topic = await service.get(topicId);
      const mine = await service.myRegistration(topic.roundId);
      setState({ kind: 'ready', topic, mine });
    } catch (err: unknown) {
      if (err instanceof TopicNotFoundError) setState({ kind: 'not-found' });
      else
        setState({
          kind: 'error',
          message: errorText(err, 'Không tải được đề tài.'),
        });
    }
  }, [service, topicId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (run: () => Promise<MyRegistration>, success: string) => {
    setBusy(true);
    setMemberError(null);
    try {
      // Máy chủ trả tình trạng nhóm mới; đọc lại đề tài để có trạng thái hiện hành.
      const next = await run();
      const fresh = await service.get(topicId);
      setDialog(null);
      setMemberCode('');
      toast.success(success);
      setState({ kind: 'ready', topic: fresh, mine: next });
    } catch (err: unknown) {
      setDialog(null);
      if (err instanceof RegistrationError && err.kind === 'member') {
        setMemberError(err.message);
      } else {
        // Đề tài vừa có nhóm khác nhận, hết hạn, hủy lặp...: báo đúng lời máy chủ rồi tải lại
        // để màn hình phản ánh trạng thái thật.
        toast.error(
          errorText(err, 'Không thực hiện được thao tác. Thử lại sau.'),
        );
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <nav className="tpc-crumb" aria-label="Điều hướng">
      <Link href={LIST_HREF} className="tpc-crumb-back">
        <ArrowLeft size={16} aria-hidden="true" /> Đăng ký đề tài
      </Link>
    </nav>
  );

  if (state.kind === 'loading')
    return (
      <p role="status" className="app-muted">
        Đang tải đề tài...
      </p>
    );
  if (state.kind === 'not-found')
    return (
      <div className="tpc-page">
        {back}
        <section className="status-state app-empty">
          <h2>Không tìm thấy đề tài</h2>
          <p>
            Đề tài không tồn tại, chưa được công bố hoặc không thuộc đợt của
            bạn.
          </p>
        </section>
      </div>
    );
  if (state.kind === 'error')
    return (
      <div className="tpc-page">
        {back}
        <section className="status-state" role="alert">
          <h2>Không tải được đề tài</h2>
          <p>{state.message}</p>
        </section>
      </div>
    );

  const { topic, mine } = state;
  const group = mine.group;
  const ownTopic = mine.topic?.id === topic.id;
  const otherTopic = mine.topic && !ownTopic ? mine.topic : null;
  const available = topic.status === 'Chưa đăng ký';
  const isRepresentative = group?.representativeId === viewerId;
  const representative = group?.members.find(
    (m) => m.id === group.representativeId,
  );
  const ownMembers = group?.members ?? [];

  const registerPanel = () => {
    if (ownTopic)
      return (
        <section className="tpc-reg-card" aria-labelledby="reg-title">
          <h2 id="reg-title">Nhóm bạn đã ghi danh đề tài này</h2>
          <MemberList members={ownMembers} />
          {mine.canCancel ? (
            <>
              <p className="tpc-hint">
                Bất kỳ thành viên nào cũng hủy được ghi danh cho cả nhóm khi đợt
                còn mở đăng ký và nhóm chưa nộp đề cương.
              </p>
              <div className="tpc-actions">
                <button
                  type="button"
                  className="rnd-btn rnd-btn-danger-outline"
                  onClick={() => setDialog('cancel')}
                >
                  Hủy ghi danh
                </button>
              </div>
            </>
          ) : (
            <p className="tpc-note">
              <Info size={16} aria-hidden="true" />
              Đã hết thời gian đăng ký nên không hủy ghi danh được.
            </p>
          )}
        </section>
      );
    if (otherTopic)
      return (
        <section className="tpc-reg-card" aria-labelledby="reg-title">
          <h2 id="reg-title">Bạn đã có nhóm</h2>
          <p>
            Nhóm của bạn đang ghi danh đề tài{' '}
            <Link
              href={`${LIST_HREF}/${otherTopic.id}`}
              className="tpc-reg-link"
            >
              {`${otherTopic.code} · ${otherTopic.title}`}
            </Link>
            . Hủy ghi danh đề tài đó trước khi chọn đề tài khác.
          </p>
          <MemberList members={ownMembers} />
        </section>
      );
    if (!available)
      return (
        <section className="tpc-reg-card" aria-labelledby="reg-title">
          <h2 id="reg-title">Đề tài đã có nhóm</h2>
          <p>Đề tài này đã có nhóm nhận. Hãy chọn đề tài khác còn trống.</p>
          <div className="tpc-actions">
            <Link href={LIST_HREF} className="rnd-btn">
              Về danh sách đề tài
            </Link>
          </div>
        </section>
      );
    if (!mine.registrationOpen)
      return (
        <section className="tpc-reg-card" aria-labelledby="reg-title">
          <h2 id="reg-title">Ghi danh</h2>
          <p className="tpc-note">
            <Info size={16} aria-hidden="true" />
            Đã hết thời gian đăng ký đề tài của đợt.
          </p>
        </section>
      );
    if (group && !isRepresentative)
      return (
        <section className="tpc-reg-card" aria-labelledby="reg-title">
          <h2 id="reg-title">Ghi danh</h2>
          <MemberList members={ownMembers} />
          <p className="tpc-note">
            <Info size={16} aria-hidden="true" />
            {`Chỉ đại diện nhóm (${representative?.name ?? 'đại diện'}) được ghi danh cho nhóm. Nhóm giữ nguyên thành viên sau khi hủy ghi danh.`}
          </p>
        </section>
      );
    if (group)
      return (
        <section className="tpc-reg-card" aria-labelledby="reg-title">
          <h2 id="reg-title">Ghi danh</h2>
          <p>
            Nhóm của bạn giữ nguyên thành viên và đại diện từ lần ghi danh
            trước; bạn là đại diện nên ghi danh lại được cho cả nhóm.
          </p>
          <MemberList members={ownMembers} />
          <div className="tpc-actions">
            <button
              type="button"
              className="rnd-btn rnd-btn-primary"
              onClick={() => setDialog('register')}
            >
              Ghi danh bằng nhóm này
            </button>
          </div>
        </section>
      );
    return (
      <section className="tpc-reg-card" aria-labelledby="reg-title">
        <h2 id="reg-title">Ghi danh</h2>
        <p>
          Bạn sẽ là đại diện nhóm. Nhóm có 1–2 sinh viên; nhập MSSV nếu đăng ký
          cùng một bạn trong đợt. Thành viên thứ hai vào nhóm ngay và nhận thông
          báo.
        </p>
        <form
          className="tpc-reg-form"
          onSubmit={(e) => {
            e.preventDefault();
            setMemberError(null);
            setDialog('register');
          }}
        >
          <label className="rnd-label" htmlFor="reg-member">
            MSSV thành viên thứ hai (không bắt buộc)
          </label>
          <input
            id="reg-member"
            className="rnd-input"
            value={memberCode}
            maxLength={100}
            autoComplete="off"
            placeholder="Ví dụ 22520002"
            aria-invalid={memberError ? 'true' : undefined}
            aria-describedby={memberError ? 'reg-member-error' : undefined}
            onChange={(e) => {
              setMemberCode(e.target.value);
              setMemberError(null);
            }}
          />
          {memberError && (
            <p id="reg-member-error" className="rnd-field-err">
              {memberError}
            </p>
          )}
          <div className="tpc-actions">
            <button type="submit" className="rnd-btn rnd-btn-primary">
              Ghi danh
            </button>
          </div>
        </form>
      </section>
    );
  };

  const partnerCode = memberCode.trim();

  return (
    <div className="tpc-page">
      {back}
      <div className="tpc-head">
        <div className="tpc-head-text">
          <h1>{topic.title}</h1>
          <p>{`${topic.code} · ${topic.field} · GV hướng dẫn ${topic.supervisor.name}`}</p>
        </div>
        <TopicStatusChip
          status={ownTopic && mine.topic ? mine.topic.status : topic.status}
        />
      </div>


      <div className="tpc-reg-grid">
        <section className="tpc-reg-card" aria-labelledby="topic-info-title">
          <h2 id="topic-info-title">Thông tin đề tài</h2>
          <dl className="tpc-topic-detail">
            <dt>Mô tả</dt>
            <dd>{topic.description}</dd>
            <dt>Yêu cầu</dt>
            <dd>{topic.requirements || 'Không có yêu cầu riêng.'}</dd>
            <dt>Giảng viên hướng dẫn</dt>
            <dd>{`${topic.supervisor.name} (${topic.supervisor.code})`}</dd>
            <dt>Hạn đăng ký</dt>
            <dd>
              {mine.round.registrationEnd
                ? `23:59 ngày ${formatDate(mine.round.registrationEnd)}`
                : 'Chưa đặt'}
            </dd>
          </dl>
        </section>
        {registerPanel()}
      </div>

      {mine.history.length > 0 && <HistoryList items={mine.history} />}

      {dialog === 'register' && (
        <RoundModal
          titleId="reg-confirm-title"
          size="md"
          busy={busy}
          onClose={() => setDialog(null)}
          initialFocusRef={confirmRef}
        >
          <h2 id="reg-confirm-title">Xác nhận ghi danh</h2>
          <p className="rnd-modal-text">{`${topic.code} · ${topic.title}`}</p>
          {group ? (
            <MemberList members={ownMembers} />
          ) : (
            <ul className="tpc-members">
              <li>
                <strong>Bạn</strong>
                <span className="tpc-rep">Đại diện</span>
              </li>
              {partnerCode ? (
                <li>{`MSSV ${partnerCode} (thành viên)`}</li>
              ) : (
                <li className="tpc-sub">Đăng ký một mình (nhóm 1 sinh viên)</li>
              )}
            </ul>
          )}
          <p className="rnd-note rnd-note-grey">
            Đề tài được giao cho nhóm đầu tiên ghi danh hợp lệ. Sau khi ghi
            danh, nhóm giữ nguyên thành viên và đại diện trong đợt.
          </p>
          <div className="rnd-modal-actions">
            <button
              type="button"
              className="rnd-btn"
              onClick={() => setDialog(null)}
              disabled={busy}
            >
              Quay lại
            </button>
            <button
              ref={confirmRef}
              type="button"
              className="rnd-btn rnd-btn-primary"
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                void act(
                  () => service.register(topic.id, group ? '' : partnerCode),
                  'Đã ghi danh đề tài.',
                )
              }
            >
              {busy ? 'Đang ghi danh...' : 'Xác nhận ghi danh'}
            </button>
          </div>
        </RoundModal>
      )}

      {dialog === 'cancel' && (
        <RoundModal
          role="alertdialog"
          titleId="reg-cancel-title"
          size="md"
          busy={busy}
          onClose={() => setDialog(null)}
          initialFocusRef={keepRef}
        >
          <h2 id="reg-cancel-title">Hủy ghi danh cho cả nhóm?</h2>
          <p className="rnd-modal-text">
            {`Việc hủy áp dụng cho cả nhóm: đề tài ${topic.code} trở về danh sách Chưa đăng ký và nhóm khác có thể nhận. Nhóm giữ nguyên thành viên và đại diện để ghi danh lại đề tài còn trống; lần ghi danh này vẫn còn trong lịch sử.`}
          </p>
          <div className="rnd-modal-actions">
            <button
              ref={keepRef}
              type="button"
              className="rnd-btn"
              onClick={() => setDialog(null)}
              disabled={busy}
            >
              Giữ ghi danh
            </button>
            <button
              type="button"
              className="rnd-btn rnd-btn-danger"
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                void act(
                  () => service.cancel(topic.id),
                  'Đã hủy ghi danh cho cả nhóm.',
                )
              }
            >
              {busy ? 'Đang hủy...' : 'Hủy ghi danh'}
            </button>
          </div>
        </RoundModal>
      )}
    </div>
  );
};

// Route /sv/dang-ky/[id]: lấy id tài khoản từ phiên đăng nhập.
export const StudentTopicDetail: React.FC<{ topicId: string }> = ({
  topicId,
}) => {
  const { session } = useSession();
  if (session.status !== 'authenticated') return null;
  return (
    <StudentTopicDetailPage topicId={topicId} viewerId={session.user.id} />
  );
};
