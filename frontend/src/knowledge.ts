export interface KnowledgeArticle {
  id: number;
  title: string;
  summary: string;
  body?: string;
  category_id: number;
  category_name: string;
  version: number;
  updated_at: string;
  review_due_at: string;
  audience: string;
  helped?: boolean | null;
  verified_at: string;
}

export interface KnowledgeDraft {
  title: string;
  summary: string;
  body: string;
  visibility: "COMPANY" | "DEPARTMENT";
  owner_department: string;
  confidential_case: boolean;
  version: number;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED";
  review_days: number;
  updated_at: string;
}

export interface ManagedArticle {
  id: number;
  source_ticket_id: number;
  published_version: number;
  is_published: boolean;
  review_due_at: string;
  draft: KnowledgeDraft;
  can_publish: boolean;
  findings: {
    field: string;
    severity: string;
    kind: string;
    message: string;
  }[];
  revisions: {
    version: number;
    title: string;
    reviewer: string;
    approved_at: string;
  }[];
  history: { id: number; action: string; actor: string; created_at: string }[];
  open_reports: number;
  reports: {
    id: number;
    reason: string;
    version: number;
    created_at: string;
  }[];
}

export interface KnowledgeContext {
  attemptId: string;
  title: string;
  categoryId: number;
}

export interface KnowledgeMetrics {
  days: number;
  viewed_attempts: number;
  resolved_attempts: number;
  submitted_attempts: number;
  joined_attempts: number;
  pending_attempts: number;
  resolved_percent: number | null;
  scope: "company" | "department";
}
