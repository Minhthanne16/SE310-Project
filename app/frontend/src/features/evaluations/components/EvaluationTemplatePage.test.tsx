import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetNavigation } from '@/test/navigationMock';
import { createRoundService } from '@/features/rounds/services/roundService';
import {
  DuplicateTemplateNameError,
  TemplateInUseError,
  type EvaluationService,
} from '@/features/evaluations/services/evaluationService';
import type {
  EvaluationTemplate,
  TemplateAssignment,
  TemplateInput,
} from '@/types/evaluation';
import { EvaluationTemplatePage } from './EvaluationTemplatePage';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

beforeEach(() => resetNavigation('/giao-vu/phieu-danh-gia'));
afterEach(cleanup);

const ROUND = 'r-vb1-hk1';
const ROUND_NAME = 'Văn bằng 1 · HK1 2026–2027';

const template = (
  id: string,
  name: string,
  status: EvaluationTemplate['status'],
): EvaluationTemplate => ({
  id,
  name,
  description: null,
  maxScore: 10,
  status,
  criteria: [
    {
      id: `${id}-c1`,
      name: 'Nội dung',
      description: null,
      maxScore: 10,
      subCriteria: [{ id: `${id}-s1`, name: 'Báo cáo', maxScore: 10 }],
    },
  ],
  assignments: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: null,
});

// Kho giả theo hợp đồng EvaluationService; trùng tên trả lỗi như backend 409.
function fakeService(initial: EvaluationTemplate[]) {
  let templates = [...initial];
  let assignments: TemplateAssignment[] = [
    {
      roundId: ROUND,
      role: 'Supervisor',
      templateId: 'a',
      templateName: 'Phiếu hướng dẫn',
    },
  ];
  const fromInput = (id: string, input: TemplateInput): EvaluationTemplate => ({
    ...template(id, input.name, input.status),
    description: input.description,
    criteria: input.criteria.map((c, i) => ({
      id: `${id}-c${i}`,
      name: c.name,
      description: c.description,
      maxScore: c.maxScore,
      subCriteria: c.subCriteria.map((s, j) => ({
        id: `${id}-c${i}-s${j}`,
        ...s,
      })),
    })),
  });
  // Như backend: danh sách mẫu trả kèm các lần gán hiện tại.
  const withUsage = () =>
    templates.map((t) => ({
      ...t,
      assignments: assignments
        .filter((a) => a.templateId === t.id)
        .map(({ roundId, role }) => ({ roundId, role })),
    }));
  const service: EvaluationService = {
    list: vi.fn(async () => withUsage()),
    create: vi.fn(async (input: TemplateInput) => {
      if (templates.some((t) => t.name === input.name))
        throw new DuplicateTemplateNameError();
      const created = fromInput(`t${templates.length + 1}`, input);
      templates = [...templates, created];
      return created;
    }),
    update: vi.fn(async (id: string, input: TemplateInput) => {
      const updated = fromInput(id, input);
      templates = templates.map((t) => (t.id === id ? updated : t));
      return updated;
    }),
    setStatus: vi.fn(async (id, status) => {
      templates = templates.map((t) => (t.id === id ? { ...t, status } : t));
      return templates.find((t) => t.id === id)!;
    }),
    remove: vi.fn(
      async (id: string, options?: { removeAssignments?: boolean }) => {
        if (
          assignments.some((a) => a.templateId === id) &&
          !options?.removeAssignments
        )
          throw new TemplateInUseError();
        assignments = assignments.filter((a) => a.templateId !== id);
        templates = templates.filter((t) => t.id !== id);
      },
    ),
    listAssignments: vi.fn(async (roundId: string) =>
      assignments.filter((a) => a.roundId === roundId),
    ),
    listAllAssignments: vi.fn(async () => assignments),
    assign: vi.fn(async (roundId, role, templateId) => {
      const saved: TemplateAssignment = {
        roundId,
        role,
        templateId,
        templateName: templates.find((t) => t.id === templateId)!.name,
      };
      assignments = [
        ...assignments.filter(
          (a) => !(a.roundId === roundId && a.role === role),
        ),
        saved,
      ];
      return saved;
    }),
    unassign: vi.fn(async (roundId, role) => {
      assignments = assignments.filter(
        (a) => !(a.roundId === roundId && a.role === role),
      );
    }),
  };
  return service;
}

const seed = () => [
  template('a', 'Phiếu hướng dẫn', 'Active'),
  template('b', 'Phiếu phản biện', 'Active'),
  template('d', 'Phiếu hội đồng nháp', 'Draft'),
];

const renderPage = async (service = fakeService(seed())) => {
  render(
    <EvaluationTemplatePage
      evaluationService={service}
      roundService={createRoundService()}
    />,
  );
  await screen.findByRole('heading', { name: 'Danh sách mẫu phiếu' });
  return service;
};

const tableWith = (cls: string) =>
  screen.getAllByRole('table').find((t) => t.classList.contains(cls))!;
const templateTable = () => tableWith('eval-template-table');
const roundTable = () => tableWith('eval-round-table');
const row = (table: HTMLElement, text: string) =>
  within(table)
    .getAllByRole('row')
    .find((r) => r.textContent?.includes(text))!;
const dialog = () => screen.getByRole('dialog');
const button = (name: string | RegExp) =>
  within(dialog()).getByRole('button', { name });
const type = (label: string, value: string) =>
  fireEvent.change(within(dialog()).getByLabelText(label), {
    target: { value },
  });
const openCreate = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Tạo mẫu phiếu' }));

it('shows rounds with their assigned templates above the template list', async () => {
  const service = await renderPage();
  expect(service.listAllAssignments).toHaveBeenCalled();

  const r = row(roundTable(), ROUND_NAME);
  expect(r).toHaveTextContent('Phiếu hướng dẫn');
  expect(r).toHaveTextContent('Chưa gán');
  expect(r).toHaveTextContent('1/3 vai trò đã gán');
  expect(
    within(r).getByRole('button', { name: `Gán mẫu ${ROUND_NAME}` }),
  ).toBeInTheDocument();
  // Đợt đã kết thúc bị ẩn; đợt nháp vẫn hiện để gán trước khi mở đợt.
  expect(
    within(roundTable()).queryByText('Văn bằng 1 · HK2 2025–2026'),
  ).toBeNull();
  expect(
    within(roundTable()).getByText('Văn bằng 2 · HK2 2026–2027'),
  ).toBeInTheDocument();
  expect(within(roundTable()).queryByText('Đã kết thúc')).toBeNull();
});

it('derives each template state from its content and assignments', async () => {
  await renderPage();
  const state = (name: string) => row(templateTable(), name);
  expect(state('Phiếu hướng dẫn')).toHaveTextContent('Đang được sử dụng');
  expect(state('Phiếu phản biện')).toHaveTextContent('Đủ điều kiện sử dụng');
  expect(state('Phiếu hội đồng nháp')).toHaveTextContent('Nháp');
  expect(state('Phiếu hướng dẫn')).toHaveTextContent('1 vai trò');
});

it('names a new template so it does not clash and can be closed', async () => {
  const service = fakeService([
    ...seed(),
    template('m', 'Mẫu phiếu mới', 'Draft'),
  ]);
  await renderPage(service);
  openCreate();

  expect(within(dialog()).getByLabelText('Tên mẫu phiếu')).toHaveValue(
    'Mẫu phiếu mới (2)',
  );
  fireEvent.click(button('Đóng'));
  expect(screen.queryByRole('dialog')).toBeNull();

  openCreate();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('saves a new template with unfinished scores as a draft', async () => {
  const service = await renderPage();
  openCreate();

  expect(button('Hủy tạo mẫu')).toBeInTheDocument();
  expect(
    within(dialog()).getByText(/Mẫu Nháp: chưa đủ điều kiện để chấm điểm/),
  ).toBeInTheDocument();
  type('Tên mẫu phiếu', 'Phiếu thành viên hội đồng');
  type('Điểm tối đa tiêu chí 1', '4');
  type('Điểm tối đa hạng mục 1.1', '4');
  expect(within(dialog()).getByText(/^Lưu ra:/)).toHaveTextContent('Nháp');
  fireEvent.click(button('Lưu mẫu phiếu'));

  await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
  expect(vi.mocked(service.create).mock.calls[0][0]).toMatchObject({
    name: 'Phiếu thành viên hội đồng',
    maxScore: 10,
    status: 'Draft',
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(row(templateTable(), 'Phiếu thành viên hội đồng')).toHaveTextContent(
    'Nháp',
  );
});

it('saves a template whose scores add up to 10 as eligible for use', async () => {
  const service = await renderPage();
  openCreate();
  type('Tên mẫu phiếu', 'Phiếu đủ điểm');
  type('Điểm tối đa tiêu chí 1', '10');
  type('Điểm tối đa hạng mục 1.1', '4,5');
  fireEvent.click(button('+ Thêm hạng mục con'));
  type('Hạng mục 1.2', 'Tính thực tiễn');
  type('Điểm tối đa hạng mục 1.2', '5.5');
  expect(
    within(dialog()).getByText('Tổng tiêu chí chung: 10 / 10'),
  ).toBeInTheDocument();
  expect(within(dialog()).getByText(/^Lưu ra:/)).toHaveTextContent(
    'Đủ điều kiện sử dụng',
  );
  fireEvent.click(button('Lưu mẫu phiếu'));

  await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
  const input = vi.mocked(service.create).mock.calls[0][0];
  expect(input.status).toBe('Active');
  expect(input.criteria[0].subCriteria).toEqual([
    { name: 'Hạng mục 1.1', maxScore: 4.5 },
    { name: 'Tính thực tiễn', maxScore: 5.5 },
  ]);
  await waitFor(() =>
    expect(row(templateTable(), 'Phiếu đủ điểm')).toHaveTextContent(
      'Đủ điều kiện sử dụng',
    ),
  );
});

it('blocks saving a duplicate name while typing', async () => {
  await renderPage();
  openCreate();
  type('Tên mẫu phiếu', 'phiếu PHẢN biện');
  expect(
    within(dialog()).getAllByText(
      'Đã có mẫu phiếu cùng tên. Đặt tên khác để phân biệt.',
    ).length,
  ).toBeGreaterThan(0);
  expect(within(dialog()).getByLabelText('Tên mẫu phiếu')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(button('Lưu mẫu phiếu')).toBeDisabled();
});

it('opens a template read-only, switches to editing and asks before discarding', async () => {
  const service = await renderPage();
  fireEvent.click(
    within(templateTable()).getByRole('button', { name: 'Phiếu phản biện' }),
  );

  expect(
    within(dialog()).getByRole('heading', { name: 'Chi tiết mẫu phiếu' }),
  ).toBeInTheDocument();
  expect(within(dialog()).getByLabelText('Tên mẫu phiếu')).toBeDisabled();
  fireEvent.click(button('Chỉnh sửa'));
  expect(
    within(dialog()).getByRole('heading', { name: 'Sửa mẫu phiếu' }),
  ).toBeInTheDocument();

  type('Tên tiêu chí chung 1', 'Nội dung đã sửa');
  fireEvent.click(button('Đóng'));
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Tiếp tục sửa',
    }),
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Bỏ thay đổi',
    }),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(service.update).not.toHaveBeenCalled();
});

it('edits from the quick action and keeps an in-use template eligible', async () => {
  const service = await renderPage();
  fireEvent.click(
    within(templateTable()).getByRole('button', {
      name: 'Chỉnh sửa Phiếu hướng dẫn',
    }),
  );
  expect(
    within(dialog()).getByText(/Đang được sử dụng cho: .*Giảng viên hướng dẫn/),
  ).toBeInTheDocument();

  type('Điểm tối đa tiêu chí 1', '8');
  expect(within(dialog()).getByRole('alert')).toHaveTextContent(
    'Mẫu đang được sử dụng nên phải giữ đủ điều kiện',
  );
  expect(button('Lưu mẫu phiếu')).toBeDisabled();

  type('Điểm tối đa tiêu chí 1', '10');
  type('Tên tiêu chí chung 1', 'Nội dung mới');
  fireEvent.click(button('Lưu mẫu phiếu'));
  await waitFor(() => expect(service.update).toHaveBeenCalledTimes(1));
  expect(vi.mocked(service.update).mock.calls[0][1].status).toBe('Active');
});

it('asks before removing a criterion', async () => {
  await renderPage();
  fireEvent.click(
    within(templateTable()).getByRole('button', {
      name: 'Chỉnh sửa Phiếu phản biện',
    }),
  );
  fireEvent.click(button('Xóa tiêu chí 1'));
  const confirm = screen.getByRole('alertdialog');
  expect(
    within(confirm).getByText('Xóa tiêu chí 1. Nội dung?'),
  ).toBeInTheDocument();
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Xóa tiêu chí' }),
  );
  expect(within(dialog()).queryByLabelText('Tên tiêu chí chung 1')).toBeNull();
  expect(
    within(dialog()).getByText('Tổng tiêu chí chung: 0 / 10'),
  ).toBeInTheDocument();
});

it('deletes an unassigned template from the list after a warning', async () => {
  const service = await renderPage();
  fireEvent.click(
    within(templateTable()).getByRole('button', {
      name: 'Xóa Phiếu phản biện',
    }),
  );
  const confirm = screen.getByRole('alertdialog');
  expect(confirm).toHaveTextContent('Mẫu chưa gán cho vai trò nào.');
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Xóa mẫu phiếu' }),
  );
  await waitFor(() =>
    expect(service.remove).toHaveBeenCalledWith('b', {
      removeAssignments: false,
    }),
  );
  await waitFor(() =>
    expect(within(templateTable()).queryByText('Phiếu phản biện')).toBeNull(),
  );
});

it('removes the assignments of an in-use template after confirming', async () => {
  const service = await renderPage();
  fireEvent.click(
    within(templateTable()).getByRole('button', {
      name: 'Xóa Phiếu hướng dẫn',
    }),
  );
  const confirm = screen.getByRole('alertdialog');
  expect(confirm).toHaveTextContent(`${ROUND_NAME} · Giảng viên hướng dẫn`);
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Gỡ gán và xóa' }),
  );
  await waitFor(() =>
    expect(service.remove).toHaveBeenCalledWith('a', {
      removeAssignments: true,
    }),
  );
  await waitFor(() =>
    expect(row(roundTable(), ROUND_NAME)).not.toHaveTextContent(
      'Phiếu hướng dẫn',
    ),
  );
});

it('assigns and unassigns templates for a round in the side panel', async () => {
  const service = await renderPage();
  fireEvent.click(
    within(roundTable()).getByRole('button', { name: `Gán mẫu ${ROUND_NAME}` }),
  );
  const reviewer = within(dialog()).getByLabelText('Giảng viên phản biện');
  // Mẫu nháp không gán được.
  expect(within(reviewer).queryByText('Phiếu hội đồng nháp')).toBeNull();

  fireEvent.change(reviewer, { target: { value: 'b' } });
  await waitFor(() =>
    expect(service.assign).toHaveBeenCalledWith(ROUND, 'Reviewer', 'b'),
  );
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Xong' }));
  await waitFor(() =>
    expect(row(roundTable(), ROUND_NAME)).toHaveTextContent(
      '2/3 vai trò đã gán',
    ),
  );
  await waitFor(() =>
    expect(row(templateTable(), 'Phiếu phản biện')).toHaveTextContent(
      'Đang được sử dụng',
    ),
  );

  fireEvent.click(
    within(roundTable()).getByRole('button', { name: `Gán mẫu ${ROUND_NAME}` }),
  );
  fireEvent.change(within(dialog()).getByLabelText('Giảng viên phản biện'), {
    target: { value: '' },
  });
  await waitFor(() =>
    expect(service.unassign).toHaveBeenCalledWith(ROUND, 'Reviewer'),
  );
});
