import { afterEach, expect, it, vi } from 'vitest';
import {
  createEvaluationService,
  DuplicateTemplateNameError,
  TemplateInUseError,
} from './evaluationService';
import type { TemplateInput } from '@/types/evaluation';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (
  status = 200,
  body: unknown = { success: true, message: '', data: null },
) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const input: TemplateInput = {
  name: 'Phiếu',
  description: null,
  maxScore: 10,
  status: 'Draft',
  criteria: [],
};

it('calls the template endpoints with the expected method and body', async () => {
  const fetchMock = stubFetch();
  const service = createEvaluationService();

  await service.list();
  await service.create(input);
  await service.update('id 1', input);
  await service.setStatus('a', 'Closed');
  await service.remove('a');
  await service.remove('a', { removeAssignments: true });
  await service.listAssignments('r-1');
  await service.assign('r-1', 'Committee', 'a');
  await service.unassign('r-1', 'Reviewer');

  const calls = fetchMock.mock.calls.map(([url, init]) => [
    url,
    init?.method ?? 'GET',
    init?.body,
  ]);
  expect(calls).toEqual([
    ['/api/evaluation-templates', 'GET', undefined],
    ['/api/evaluation-templates', 'POST', JSON.stringify(input)],
    ['/api/evaluation-templates/id%201', 'PUT', JSON.stringify(input)],
    ['/api/evaluation-templates/a/status', 'PUT', '{"status":"Closed"}'],
    ['/api/evaluation-templates/a', 'DELETE', undefined],
    ['/api/evaluation-templates/a?removeAssignments=true', 'DELETE', undefined],
    ['/api/evaluation-templates/assignments?roundId=r-1', 'GET', undefined],
    [
      '/api/evaluation-templates/assignments/r-1/Committee',
      'PUT',
      '{"templateId":"a"}',
    ],
    ['/api/evaluation-templates/assignments/r-1/Reviewer', 'DELETE', undefined],
  ]);
});

it('maps 409 responses to typed errors', async () => {
  const service = createEvaluationService();
  stubFetch(409, { success: false, message: 'Tên mẫu phiếu đã tồn tại.' });
  await expect(service.create(input)).rejects.toBeInstanceOf(
    DuplicateTemplateNameError,
  );
  await expect(service.update('a', input)).rejects.toThrow(
    'Tên mẫu phiếu đã tồn tại.',
  );
  stubFetch(409, { success: false, message: 'Đang gán.' });
  await expect(service.remove('a')).rejects.toBeInstanceOf(TemplateInUseError);
});

it('shows validation details from the backend', async () => {
  stubFetch(400, {
    success: false,
    message: 'Validation failed',
    errors: ['Tổng điểm tiêu chí chung (9) phải bằng thang điểm phiếu (10).'],
  });
  await expect(createEvaluationService().create(input)).rejects.toThrow(
    'Tổng điểm tiêu chí chung (9) phải bằng thang điểm phiếu (10).',
  );
});
