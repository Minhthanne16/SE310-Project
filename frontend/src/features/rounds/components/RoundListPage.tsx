'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Search } from 'lucide-react';
import {
  ProgramChip,
  RoundStatusChip,
} from '@/features/rounds/components/RoundChips';
import { CreateRoundDialog } from '@/features/rounds/components/CreateRoundDialog';
import {
  RoundLifecycleDialog,
  type LifecycleKind,
} from '@/features/rounds/components/RoundLifecycleDialog';
import { currentMilestone } from '@/features/rounds/roundUtils';
import {
  roundService as defaultRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import {
  ROUND_PROGRAMS,
  type Round,
  type RoundFilters,
  type RoundProgram,
  type RoundStatus,
} from '@/types/round';

interface RoundListPageProps {
  roundService?: RoundService;
}

type StatusFilter = RoundStatus | 'Tất cả';

const PAGE_SIZE = 10;
// Thứ tự trong canvas: Đang diễn ra, Nháp, Đã kết thúc, Tất cả.
const STATUS_ORDER: StatusFilter[] = [
  'Đang diễn ra',
  'Nháp',
  'Đã kết thúc',
  'Tất cả',
];

// Màn Danh sách đợt khóa luận của Giáo vụ (docs/DESIGN/03). Lọc phía dịch vụ,
// phân trang phía client như màn Quản lý người dùng.
export const RoundListPage: React.FC<RoundListPageProps> = ({
  roundService = defaultRoundService,
}) => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('Đang diễn ra');
  const [program, setProgram] = useState<RoundProgram | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<{
    kind: LifecycleKind;
    roundId: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const filters: RoundFilters = { status, program, search };
    try {
      const [filtered, everything] = await Promise.all([
        roundService.list(filters),
        roundService.list(),
      ]);
      setRounds(filtered);
      setAllRounds(everything);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Không tải được danh sách đợt.',
      );
    } finally {
      setLoading(false);
    }
  }, [roundService, status, program, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(rounds.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rounds.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const dialogRound = dialog
    ? allRounds.find((r) => r.id === dialog.roundId)
    : undefined;
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeCreate = useCallback(() => setCreating(false), []);

  return (
    <>
      <div className="app-page-heading">
        <h1>Đợt khóa luận</h1>
        <p>Tạo, mở, kết thúc và xóa đợt; bấm một đợt để xem chi tiết.</p>
      </div>

      <div className="app-toolbar">
        <div
          className="app-filters"
          role="search"
          aria-label="Lọc trạng thái, chương trình, tìm kiếm"
        >
          <div className="app-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm kiếm"
              placeholder="Tìm theo tên đợt"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="app-select"
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="app-select"
            aria-label="Lọc theo chương trình"
            value={program}
            onChange={(e) => {
              setProgram(e.target.value as RoundProgram | '');
              setPage(1);
            }}
          >
            <option value="">Tất cả chương trình</option>
            {ROUND_PROGRAMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="app-toolbar-actions">
          <button
            type="button"
            className="app-button app-button-primary"
            aria-haspopup="dialog"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Tạo đợt
          </button>
        </div>
      </div>

      {loading ? (
        <p role="status" className="app-muted">
          Đang tải danh sách đợt...
        </p>
      ) : loadError ? (
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
      ) : rounds.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Không có đợt phù hợp</h2>
          <p>
            {allRounds.length === 0
              ? 'Chưa có đợt nào. Bấm “Tạo đợt” để bắt đầu.'
              : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'}
          </p>
        </section>
      ) : (
        <>
          <div className="app-table-scroll">
            <table className="app-table app-round-table">
              <thead>
                <tr>
                  <th scope="col">Tên đợt</th>
                  <th scope="col">Chương trình</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Mốc hiện tại</th>
                  <th scope="col">Giảng viên</th>
                  <th scope="col">Sinh viên</th>
                  <th scope="col">
                    <span className="app-visually-hidden">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((round) => {
                  const milestone = currentMilestone(round, roundService.today);
                  return (
                    <tr key={round.id}>
                      <td>
                        <Link
                          className="app-link"
                          href={`/giao-vu/dot/${round.id}`}
                        >
                          {round.name}
                        </Link>
                      </td>
                      <td>
                        <ProgramChip program={round.program} />
                      </td>
                      <td>
                        <RoundStatusChip status={round.status} />
                      </td>
                      <td>{milestone?.name ?? '—'}</td>
                      <td>{round.lecturerIds.length}</td>
                      <td>{round.studentIds.length}</td>
                      <td>
                        <div className="app-toolbar-actions">
                          {round.status === 'Nháp' && (
                            <>
                              <button
                                type="button"
                                className="app-button app-button-small"
                                aria-haspopup="dialog"
                                aria-label={`Mở đợt ${round.name}`}
                                onClick={() =>
                                  setDialog({ kind: 'open', roundId: round.id })
                                }
                              >
                                Mở đợt
                              </button>
                              <button
                                type="button"
                                className="app-button app-button-small app-button-danger"
                                aria-haspopup="dialog"
                                aria-label={`Xóa đợt ${round.name}`}
                                onClick={() =>
                                  setDialog({
                                    kind: 'remove',
                                    roundId: round.id,
                                  })
                                }
                              >
                                Xóa đợt
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="app-pagination" aria-label="Phân trang">
            <span className="app-muted">
              {rounds.length} đợt · Trang {currentPage}/{pageCount}
            </span>
            <div className="app-toolbar-actions">
              <button
                type="button"
                className="app-button app-button-small"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Trước
              </button>
              <button
                type="button"
                className="app-button app-button-small"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Sau
              </button>
            </div>
          </nav>
        </>
      )}

      {creating && (
        <CreateRoundDialog
          roundService={roundService}
          rounds={allRounds}
          onClose={closeCreate}
          onCreated={(created) => {
            setCreating(false);
            toast.success(`Đã tạo đợt “${created.name}”.`);
            // Đợt mới là Nháp: chuyển bộ lọc để thấy ngay đợt vừa tạo.
            setStatus('Nháp');
            setProgram('');
            setSearch('');
            setPage(1);
            void load();
          }}
        />
      )}

      {dialog && dialogRound && (
        <RoundLifecycleDialog
          kind={dialog.kind}
          round={dialogRound}
          roundService={roundService}
          onClose={closeDialog}
          onDone={() => {
            setDialog(null);
            void load();
          }}
        />
      )}
    </>
  );
};
