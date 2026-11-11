import axios from "axios";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const api = axios.create({ baseURL: "/api", withCredentials: true });
export const statuses: Record<string, string> = {
  NEW: "Новое",
  IN_REVIEW: "На рассмотрении",
  IN_PROGRESS: "В работе",
  AWAITING_CLARIFICATION: "Ожидает уточнения",
  IMPLEMENTED: "Реализовано",
  REJECTED: "Отклонено",
  CLOSED: "Закрыто",
};
export const types: Record<string, string> = {
  PROBLEM: "Проблема",
  PROPOSAL: "Предложение",
  PRAISE: "Положительный отзыв",
};
export const priorities: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
};
export const roles: Record<string, string> = {
  ADMIN: "Администратор",
  MANAGER: "Руководитель",
  EMPLOYEE: "Сотрудник",
};
export const transitions: Record<string, string[]> = {
  NEW: ["IN_REVIEW", "IN_PROGRESS", "AWAITING_CLARIFICATION", "REJECTED"],
  IN_REVIEW: [
    "IN_PROGRESS",
    "AWAITING_CLARIFICATION",
    "IMPLEMENTED",
    "REJECTED",
  ],
  IN_PROGRESS: ["AWAITING_CLARIFICATION", "IMPLEMENTED", "REJECTED"],
  AWAITING_CLARIFICATION: ["IN_REVIEW", "IN_PROGRESS", "REJECTED"],
  IMPLEMENTED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};
export const date = (v: string) =>
  new Date(v + "Z").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
export const datetime = (v: string) =>
  new Date(v + "Z").toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data?.detail;
    return typeof d === "string"
      ? d
      : Array.isArray(d)
        ? "Проверьте заполнение полей"
        : "Сервер недоступен. Проверьте подключение.";
  }
  return "Не удалось выполнить действие";
}
export interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  department: string;
  position: string;
  is_active: boolean;
}
export interface Category {
  id: number;
  name: string;
  description: string;
  default_assignee_id: number | null;
  sla_first_response_hours: number;
  is_active: boolean;
  sort_order: number;
}
export interface Ticket {
  id: number;
  number: string;
  title: string;
  description: string;
  proposed_solution: string | null;
  type: string;
  status: string;
  priority: string;
  category_id: number;
  category_name: string;
  author_id: number;
  author_name: string;
  department: string;
  assignee_id: number | null;
  assignee_name: string | null;
  resolution: string | null;
  overdue: boolean;
  created_at: string;
  updated_at: string;
  due_at: string;
  first_response_at: string | null;
  comments: Comment[];
  history: History[];
  attachments: Attachment[];
  attention_reasons?: AttentionReason[];
  last_activity_at?: string;
}
export interface Comment {
  id: number;
  author_name: string;
  body: string;
  is_clarification_request: boolean;
  created_at: string;
}
export interface History {
  id: number;
  actor_name: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}
export interface Attachment {
  id: number;
  filename: string;
  size_bytes: number;
}
export interface Summary {
  total: number;
  closed_percent: number;
  average_first_response_hours: number | null;
  overdue_count: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  overdue_tickets: Ticket[];
}

export type AttentionReason = "unassigned" | "overdue" | "stale";
export const attentionLabels: Record<AttentionReason, string> = {
  unassigned: "Без ответственного",
  overdue: "Просрочен ответ",
  stale: "Без движения",
};
export interface AttentionSummary {
  counts: Record<AttentionReason | "total", number>;
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
  stale_days: number;
  generated_at: string;
  notifications: { enabled: boolean };
}
