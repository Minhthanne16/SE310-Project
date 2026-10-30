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

beforeEach(() => resetNavigation('/giao-vu/phieu-danh-gia?dot=r-vb1-hk1'));
afterEach(cleanup);

const ROUND = 'r-vb1-hk1';

const template = (
  id: string,
  name: string,
  status: EvaluationTemplate['status'],
  assignments: EvaluationTemplate['assignments'] = [],
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
  assignments,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: null,
});

// Kho giả theo hợp đồng EvaluationService; trùng tên trả lỗi như backend 409.
function fakeService(initial: EvaluationTemplate[]) {
  let templates = [...initial];
  let assignments: TemplateAssignment[] = initial.flatMap((t) =>
    t.assignments.map((a) => ({
      ...a,
      templateId: t.id,
      templateName: t.name,
    })),
  );
  const fromInput = (
    id: string,
    input: TemplateInput,
    status = input.status,
  ): EvaluationTemplate => ({
    ...template(id, input.name, status),
    description: input.description,
    maxScore: input.maxScore,
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
      const updated = {
        ...fromInput(id, input),
        assignments: templates.find((t) => t.id === id)!.assignments,
      };
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
          templates.find((t) => t.id === id)?.assignments.length &&
          !options?.removeAssignments
        )
          throw new TemplateInUseError();
        templates = templates.filter((t) => t.id !== id);
      },
    ),
    listAssignments: vi.fn(async (roundId: string) =>
      assignments.filter((a) => a.roundId === roundId),
    ),
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
  template('a', 'Phiếu hướng dẫn', 'Active', [
    { roundId: ROUND, role: 'Supervisor' },
  ]),
  template('b', 'Phiếu phản biện', 'Active'),
  template('d', 'Phiếu hội đồng nháp', 'Draft'),
  template('c', 'Phiếu hội đồng cũ', 'Closed'),
];

const renderPage = async (service = fakeService(seed())) => {
  render(
    <EvaluationTemplatePage
      evaluationService={service}
      roundService={createRoundService()}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Mẫu phiếu đánh giá' });
  await screen.findByRole('list', { name: 'Danh sách mẫu phiếu' });
  return service;
};

const list = () => screen.getByRole('list', { name: 'Danh sách mẫu phiếu' });
const card = (name: RegExp) => {
  const found = within(list())
    .getAllByRole('listitem')
    .find((item) => name.test(item.textContent ?? ''));
  if (!found) throw new Error(`Không thấy thẻ mẫu ${name}`);
  return found;
};
const nameInput = () =>
  screen.getByLabelText('Tên mẫu phiếu') as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const button = (name: string) => screen.getByRole('button', { name });

it('shows the role assignments of the round and template cards with their status', async () => {
  const service = await renderPage();
  expect(service.listAssignments).toHaveBeenCalledWith(ROUND);
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Giảng viên hướng dẫn') as HTMLSelectElement)
        .value,
    ).toBe('a'),
  );
  expect(screen.getByText('Chấm CBPB · hệ số 2')).toBeInTheDocument();

  expect(within(list()).getAllByRole('listitem')).toHaveLength(4);
  expect(card(/Phiếu hướng dẫn/)).toHaveTextContent(
    'Đang gán: Giảng viên hướng dẫn',
  );
  expect(card(/Phiếu phản biện/)).toHaveTextContent('Đang dùng');
  expect(card(/Phiếu hội đồng nháp/)).toHaveTextContent('Nháp');
  expect(card(/Phiếu hội đồng cũ/)).toHaveTextContent('Đã đóng');
  expect(card(/Phiếu hướng dẫn/)).toHaveTextContent(
    '1 tiêu chí chung · 1 hạng mục con',
  );
  // Mẫu đầu tiên được mở trong trình sửa.
  expect(nameInput().value).toBe('Phiếu hướng dẫn');
  expect(screen.getByText('10 điểm')).toBeInTheDocument();
});

it('creates a template from the default draft and saves it as a draft', async () => {
  const service = await renderPage();
  fireEvent.click(button('Tạo mẫu phiếu'));

  expect(card(/Mẫu phiếu mới \(chưa lưu\)/)).toBeInTheDocument();
  expect(nameInput().value).toBe('Mẫu phiếu mới');
  type('Tên mẫu phiếu', 'Phiếu thành viên hội đồng');
  type('Mô tả tiêu chí 1', 'Đánh giá qua phần trình bày');
  type('Điểm tối đa hạng mục 1.1', '4.5');
  fireEvent.click(button('+ Thêm hạng mục con'));
  type('Hạng mục 1.2', 'Tính thực tiễn');
  type('Điểm tối đa hạng mục 1.2', '5.5');
  expect(screen.getByText('Tổng hạng mục con: 10 = 10')).toBeInTheDocument();
  expect(screen.getByText('Tổng tiêu chí chung: 10 / 10')).toBeInTheDocument();
  fireEvent.click(button('Lưu mẫu phiếu'));

  await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
  expect(service.create).toHaveBeenCalledWith({
    name: 'Phiếu thành viên hội đồng',
    description: null,
    maxScore: 10,
    status: 'Draft',
    criteria: [
      {
        name: 'Tiêu chí 1',
        description: 'Đánh giá qua phần trình bày',
        maxScore: 10,
        subCriteria: [
          { name: 'Hạng mục 1.1', maxScore: 4.5 },
          { name: 'Tính thực tiễn', maxScore: 5.5 },
        ],
      },
    ],
  });
  expect(
    await screen.findByText(
      'Đã tạo mẫu phiếu Phiếu thành viên hội đồng ở trạng thái Nháp.',
    ),
  ).toBeInTheDocument();
  expect(card(/Phiếu thành viên hội đồng/)).toHaveAttribute(
    'aria-current',
    'true',
  );
});

it('disables saving while totals do not match and explains why', async () => {
  const service = await renderPage();
  fireEvent.click(button('Tạo mẫu phiếu'));
  fireEvent.click(button('+ Thêm tiêu chí chung'));

  expect(screen.getByText('Tổng tiêu chí chung: 10 / 10')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Tổng hạng mục con chưa khớp điểm tiêu chí ở tiêu chí 2.',
  );
  type('Điểm tối đa tiêu chí 2', '2');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Tổng điểm các tiêu chí chung phải bằng 10 (đang là 12).',
  );
  expect(button('Lưu mẫu phiếu')).toBeDisabled();
  expect(service.create).not.toHaveBeenCalled();
});

it('warns about a duplicate template name while typing', async () => {
  await renderPage();
  fireEvent.click(button('Tạo mẫu phiếu'));
  type('Tên mẫu phiếu', 'phiếu PHẢN biện');
  expect(
    screen.getByText('Đã có mẫu phiếu cùng tên. Đặt tên khác để phân biệt.'),
  ).toBeInTheDocument();
  expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
  expect(button('Lưu mẫu phiếu')).toBeDisabled();
});

it('cancels unsaved changes and asks before switching template', async () => {
  const service = await renderPage();
  type('Tên tiêu chí chung 1', 'Nội dung đã sửa');
  fireEvent.click(button('Hủy thay đổi'));
  expect(
    (screen.getByLabelText('Tên tiêu chí chung 1') as HTMLInputElement).value,
  ).toBe('Nội dung');
  expect(
    screen.getByText('Đã hủy thay đổi, mẫu phiếu trở lại bản đã lưu.'),
  ).toBeInTheDocument();

  type('Tên tiêu chí chung 1', 'Nội dung đã sửa');
  fireEvent.click(card(/Phiếu phản biện/));
  const confirm = screen.getByRole('alertdialog');
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Tiếp tục sửa' }),
  );
  expect(nameInput().value).toBe('Phiếu hướng dẫn');

  fireEvent.click(button('Lưu mẫu phiếu'));
  await waitFor(() => expect(service.update).toHaveBeenCalledTimes(1));
  expect(vi.mocked(service.update).mock.calls[0][1].status).toBe('Active');
  expect(
    await screen.findByText(
      'Đã lưu mẫu phiếu. Phiếu đang gán sẽ dùng bản mới cho lần chấm tiếp theo.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(card(/Phiếu phản biện/));
  expect(nameInput().value).toBe('Phiếu phản biện');
});

it('asks before removing a criterion', async () => {
  await renderPage();
  fireEvent.click(button('Xóa tiêu chí 1'));
  const confirm = screen.getByRole('alertdialog');
  expect(
    within(confirm).getByText('Xóa tiêu chí 1. Nội dung?'),
  ).toBeInTheDocument();
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Xóa tiêu chí' }),
  );
  expect(screen.queryByLabelText('Tên tiêu chí chung 1')).toBeNull();
  expect(screen.getByText('Tổng tiêu chí chung: 0 / 10')).toBeInTheDocument();
});

it('deletes an assigned template after confirming that it is unassigned', async () => {
  const service = await renderPage();
  fireEvent.click(button('Xóa mẫu phiếu'));
  const confirm = screen.getByRole('alertdialog');
  expect(confirm).toHaveTextContent(
    'Mẫu đang gán cho Văn bằng 1 · HK1 2026–2027 · Giảng viên hướng dẫn nhưng chưa có điểm nên xóa được.',
  );
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Xóa mẫu phiếu' }),
  );

  await waitFor(() =>
    expect(service.remove).toHaveBeenCalledWith('a', {
      removeAssignments: true,
    }),
  );
  expect(
    await screen.findByText(
      'Đã xóa Phiếu hướng dẫn. Cần gán mẫu khác cho Văn bằng 1 · HK1 2026–2027 · Giảng viên hướng dẫn.',
    ),
  ).toBeInTheDocument();
  expect(within(list()).queryByText('Phiếu hướng dẫn')).toBeNull();
});

it('moves a saved draft to active', async () => {
  const service = await renderPage();
  fireEvent.click(card(/Phiếu hội đồng nháp/));
  fireEvent.click(button('Chuyển sang đang dùng'));
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Chuyển sang đang dùng',
    }),
  );
  await waitFor(() =>
    expect(service.setStatus).toHaveBeenCalledWith('d', 'Active'),
  );
  await waitFor(() =>
    expect(card(/Phiếu hội đồng nháp/)).toHaveTextContent('Đang dùng'),
  );
});

it('keeps a closed template read-only and offers a copy', async () => {
  await renderPage();
  fireEvent.click(card(/Phiếu hội đồng cũ/));
  expect(nameInput()).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Lưu mẫu phiếu' })).toBeNull();

  fireEvent.click(button('Tạo bản sao'));
  expect(nameInput().value).toBe('Phiếu hội đồng cũ (bản sao)');
  expect(nameInput()).not.toBeDisabled();
  expect(card(/Mẫu phiếu mới \(chưa lưu\)/)).toBeInTheDocument();
});

it('assigns and unassigns a template as soon as it is chosen', async () => {
  const service = await renderPage();
  const reviewer = await screen.findByLabelText('Giảng viên phản biện');
  // Mẫu nháp và mẫu đã đóng không có trong danh sách chọn.
  expect(within(reviewer).queryByText('Phiếu hội đồng nháp')).toBeNull();
  expect(within(reviewer).queryByText('Phiếu hội đồng cũ')).toBeNull();

  fireEvent.change(reviewer, { target: { value: 'b' } });
  await waitFor(() =>
    expect(service.assign).toHaveBeenCalledWith(ROUND, 'Reviewer', 'b'),
  );
  await waitFor(() =>
    expect(card(/Phiếu phản biện/)).toHaveTextContent(
      'Đang gán: Giảng viên phản biện',
    ),
  );
  fireEvent.change(screen.getByLabelText('Giảng viên phản biện'), {
    target: { value: '' },
  });
  await waitFor(() =>
    expect(service.unassign).toHaveBeenCalledWith(ROUND, 'Reviewer'),
  );
});
