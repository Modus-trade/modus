import { File } from 'expo-file-system';
// Клиент к тому же FastAPI, что и веб-версия (modus/backend).
// Сессия хранится в httpOnly cookie: iOS сам сохраняет её в системном хранилище cookie.

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://modus-trade.makquiz.site').replace(/\/$/, '');

export type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type Status =
  | 'NEW'
  | 'IN_REVIEW'
  | 'IN_PROGRESS'
  | 'AWAITING_CLARIFICATION'
  | 'IMPLEMENTED'
  | 'REJECTED'
  | 'CLOSED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketType = 'PROBLEM' | 'PROPOSAL' | 'PRAISE';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
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
}

export interface Ticket {
  id: number;
  number: string;
  type: TicketType;
  title: string;
  description: string;
  proposed_solution: string | null;
  status: Status;
  priority: Priority;
  resolution: string | null;
  category_id: number;
  category_name: string;
  author_id: number;
  author_name: string;
  department: string;
  assignee_id: number | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
  due_at: string;
  first_response_at: string | null;
  closed_at: string | null;
  overdue: boolean;
}

export interface Comment {
  id: number;
  author_id: number;
  author_name: string;
  body: string;
  is_clarification_request: boolean;
  created_at: string;
}

export interface HistoryItem {
  id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor_name: string;
  created_at: string;
}

export interface Attachment {
  id: number;
  filename: string;
  size_bytes: number;
  content_type: string;
  uploaded_by_id: number;
  created_at: string;
}

export const attachmentUrl = (id: number) => `${API_URL}/api/attachments/${id}`;

export interface TicketDetail extends Ticket {
  comments: Comment[];
  history: HistoryItem[];
  attachments: Attachment[];
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface Summary {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  closed_percent: number;
  average_first_response_hours: number | null;
  overdue_count: number;
  overdue_tickets: Ticket[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function errorText(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return 'Проверьте правильность заполнения';
  if (status === 0) return 'Нет связи с сервером';
  return `Ошибка сервера (${status})`;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (e) {
    console.warn(`[api] ${init.method ?? 'GET'} ${path} не дошёл до сервера:`, e instanceof Error ? e.message : e);
    throw new ApiError(0, `Сервер недоступен: ${API_URL}. Запустите бэкенд Модус.`);
  }
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) throw new ApiError(response.status, errorText(body, response.status));
  return body as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  login: (email: string, password: string) =>
    request<User>('/api/auth/login', { method: 'POST', body: json({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request<User>('/api/auth/me'),
  tickets: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const query = Object.entries({ page_size: 100, ...params })
      .filter(([, v]) => v !== undefined && String(v) !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return request<Page<Ticket>>(`/api/tickets?${query}`);
  },
  ticket: (id: number | string) => request<TicketDetail>(`/api/tickets/${id}`),
  create: (data: {
    type: TicketType;
    category_id: number;
    title: string;
    description: string;
    proposed_solution?: string | null;
  }) => request<Ticket>('/api/tickets', { method: 'POST', body: json(data) }),
  patch: (id: number, data: Partial<{ status: Status; priority: Priority; assignee_id: number | null; resolution: string }>) =>
    request<Ticket>(`/api/tickets/${id}`, { method: 'PATCH', body: json(data) }),
  comment: (id: number, body: string, is_clarification_request = false) =>
    request(`/api/tickets/${id}/comments`, { method: 'POST', body: json({ body, is_clarification_request }) }),
  upload: (id: number, file: { uri: string; name: string; mimeType?: string }) => {
    // В Expo SDK 58 fetch принимает только настоящие Blob — берём файл через expo-file-system.
    const form = new FormData();
    form.append('file', new File(file.uri), file.name);
    return request(`/api/tickets/${id}/attachments`, { method: 'POST', body: form });
  },
  categories: () => request<Category[]>('/api/categories'),
  assignees: () => request<User[]>('/api/assignees'),
  summary: () => request<Summary>('/api/analytics/summary'),
};

/** Сервер отдаёт даты в UTC без суффикса зоны. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
}
