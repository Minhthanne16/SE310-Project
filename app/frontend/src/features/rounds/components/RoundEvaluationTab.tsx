'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import '@/features/rounds/rounds.css';
import {
  evaluationService as defaultEvaluationService,
  type EvaluationService,
} from '@/features/evaluations/services/evaluationService';
import {
  topicService as defaultTopicService,
  type TopicService,
} from '@/features/topics/services/topicService';
import { GRADING_ROLES } from '@/types/evaluation';
import type { Round } from '@/types/round';
import type { Topic } from '@/types/topic';

interface RoundEvaluationTabProps {
  round: Round;
  topicService?: TopicService;
  evaluationService?: EvaluationService;
}

interface EvalCard {
  kind: string;
  title: string;
  sub: string;
  href: string;
  cta: string;
  // Cần giáo vụ xử lý: viền đậm, chữ phụ màu cảnh báo.
  attention: boolean;
}

const roundHref = (path: string, round: Round) =>
  `${path}?dot=${encodeURIComponent(round.id)}`;

function reviewCard(round: Round, topics: Topic[]): EvalCard {
  const total = topics.length;
  const assigned = topics.filter((t) => t.reviewer !== null).length;
  const missing = total - assigned;
  const base = {
    kind: 'PHẢN BIỆN',
    href: roundHref('/giao-vu/phan-bien', round),
    cta: 'Mở Giảng viên phản biện',
  };
  if (round.status === 'Nháp')
    return {
      ...base,
      title: 'Chưa mở',
      sub: 'Đợt đang Nháp.',
      attention: false,
    };
  if (total === 0)
    return {
      ...base,
      title: 'Chưa có đề tài',
      sub: 'Phân công được sau khi có đề tài và sinh viên nộp báo cáo.',
      attention: false,
    };
  return {
    ...base,
    title: `${assigned}/${total} đề tài đã có phản biện`,
    sub:
      missing > 0
        ? `${missing} đề tài chưa phân công.`
        : round.status === 'Đã kết thúc'
          ? 'Hoàn tất.'
          : 'Đã phân công đủ.',
    attention: missing > 0 && round.status !== 'Đã kết thúc',
  };
}

function councilCard(round: Round, topics: Topic[]): EvalCard {
  const councils = new Set(
    topics.map((t) => t.council).filter((c): c is string => c !== null),
  );
  const unassigned = topics.filter((t) => t.council === null).length;
  const base = {
    kind: 'HỘI ĐỒNG BẢO VỆ',
    href: roundHref('/giao-vu/hoi-dong', round),
    cta: 'Mở Hội đồng bảo vệ',
  };
  if (round.status === 'Nháp')
    return {
      ...base,
      title: 'Chưa mở',
      sub: 'Đợt đang Nháp.',
      attention: false,
    };
  if (councils.size === 0)
    return {
      ...base,
      title: 'Chưa có hội đồng',
      sub: 'Tạo hội đồng khi gần đến hạn nộp báo cáo cuối kỳ.',
      attention: false,
    };
  return {
    ...base,
    title: `${councils.size} hội đồng`,
    sub:
      unassigned > 0
        ? `Còn ${unassigned} đề tài chưa xếp vào hội đồng.`
        : 'Mọi đề tài đã được xếp vào hội đồng.',
    attention: unassigned > 0 && round.status !== 'Đã kết thúc',
  };
}

// Tab Đánh giá của chi tiết đợt (artboard GiaoVu-DotKhoaLuan): chỉ tóm tắt phiếu
// đánh giá, phản biện và hội đồng của đợt; thao tác làm ở các trang riêng, mở
// sang với bộ lọc đợt đang xem.
export const RoundEvaluationTab: React.FC<RoundEvaluationTabProps> = ({
  round,
  topicService = defaultTopicService,
  evaluationService = defaultEvaluationService,
}) => {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [assigned, setAssigned] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTopics(null);
    setAssigned(null);
    setLoadError(false);
    topicService
      .list({ roundId: round.id })
      .then((result) => {
        if (!cancelled) setTopics(result.items);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    evaluationService
      .listAssignments(round.id)
      .then((list) => {
        if (!cancelled) setAssigned(new Set(list.map((a) => a.role)).size);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [topicService, evaluationService, round.id]);

  if (loadError)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được tóm tắt đánh giá</h2>
        <p>Thử lại sau.</p>
      </section>
    );

  if (topics === null || assigned === null)
    return (
      <p role="status" className="rnd-hint">
        Đang tải tóm tắt đánh giá...
      </p>
    );

  const roles = GRADING_ROLES.length;
  const forms: EvalCard = {
    kind: 'PHIẾU ĐÁNH GIÁ',
    title:
      assigned >= roles
        ? `Đã gán đủ ${roles}/${roles} vai trò`
        : `Đã gán ${assigned}/${roles} vai trò`,
    sub:
      assigned >= roles
        ? round.status === 'Đã kết thúc'
          ? 'Đợt đã kết thúc, chỉ để xem.'
          : 'Hướng dẫn, phản biện, hội đồng đều đã có mẫu.'
        : round.status === 'Nháp'
          ? 'Cần gán đủ mẫu cho các vai trò trước khi mở đợt.'
          : 'Còn thiếu mẫu cho một số vai trò chấm.',
    href: roundHref('/giao-vu/phieu-danh-gia', round),
    cta: 'Mở Phiếu đánh giá',
    attention: assigned < roles && round.status !== 'Đã kết thúc',
  };
  const cards = [forms, reviewCard(round, topics), councilCard(round, topics)];

  return (
    <div className="rnd-panel" aria-label="Đánh giá của đợt">
      <span className="rnd-hint">
        Tóm tắt phiếu đánh giá, phản biện và hội đồng của đợt này. Thao tác chi
        tiết làm ở các trang riêng bên dưới.
      </span>
      <div className="rnd-eval-grid">
        {cards.map((c) => (
          <Link
            key={c.kind}
            href={c.href}
            className={`rnd-eval-card${c.attention ? ' rnd-eval-card-attn' : ''}`}
          >
            <span className="rnd-eyebrow">{c.kind}</span>
            <b className="rnd-eval-title">{c.title}</b>
            <span className="rnd-eval-sub">{c.sub}</span>
            <span className="rnd-link">{c.cta}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};
