// Hợp đồng /api/evaluation-templates (EvaluationTemplatesController ở backend).

export const TEMPLATE_STATUSES = ['Active', 'Closed', 'Draft'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = {
  Active: 'Đang dùng',
  Draft: 'Nháp',
  Closed: 'Đã đóng',
};

// Chủ tịch và thư ký dùng chung mẫu Hội đồng.
export const GRADING_ROLES = ['Supervisor', 'Reviewer', 'Committee'] as const;
export type GradingRole = (typeof GRADING_ROLES)[number];

export const GRADING_ROLE_LABEL: Record<GradingRole, string> = {
  Supervisor: 'Giảng viên hướng dẫn',
  Reviewer: 'Giảng viên phản biện',
  Committee: 'Thành viên hội đồng',
};

export interface SubCriterion {
  id: string;
  name: string;
  maxScore: number;
}

export interface Criterion {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
  subCriteria: SubCriterion[];
}

export interface TemplateUsage {
  roundId: string;
  role: GradingRole;
}

export interface EvaluationTemplate {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
  status: TemplateStatus;
  criteria: Criterion[];
  assignments: TemplateUsage[];
  createdAt: string;
  updatedAt: string | null;
}

export interface SubCriterionInput {
  name: string;
  maxScore: number;
}

export interface CriterionInput {
  name: string;
  description: string | null;
  maxScore: number;
  subCriteria: SubCriterionInput[];
}

export interface TemplateInput {
  name: string;
  description: string | null;
  maxScore: number;
  status: TemplateStatus;
  criteria: CriterionInput[];
}

export interface TemplateAssignment {
  roundId: string;
  role: GradingRole;
  templateId: string;
  templateName: string;
}
