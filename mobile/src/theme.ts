import type { SFSymbol } from 'sf-symbols-typescript';
import { parseDate, type Priority, type Role, type Status, type TicketType } from './api';

// Палитра сайта Модус: светлый фон, глубокий синий текст, красный акцент, мягкие тени.
// Спокойная палитра на основе сайта: мягкий фон, приглушённый синий текст, красный — только как акцент.
export const colors = {
  brand: '#16293A',
  brandSolid: '#16293A',
  accent: '#E5343A',
  background: '#F4F6F8',
  card: '#FFFFFF',
  fill: '#EAEEF2',
  label: '#16293A',
  secondary: '#6B7B8A',
  tertiary: '#A3AEB9',
  separator: '#16293A12',
  soft: '#EEF1F4',
};

export const shadow = { boxShadow: '0 1px 3px rgba(22,41,58,0.04), 0 8px 24px rgba(22,41,58,0.04)' } as const;

type Meta = { label: string; color: string; bg: string; icon: SFSymbol };

// Цвета бейджей статусов — как на сайте.
export const statusMeta: Record<Status, Meta> = {
  NEW: { label: 'Новое', color: '#497CAA', bg: '#EEF5FC', icon: 'sparkles' },
  IN_REVIEW: { label: 'На рассмотрении', color: '#746A9C', bg: '#F0F0F8', icon: 'eye' },
  IN_PROGRESS: { label: 'В работе', color: '#214E70', bg: '#E6EFF6', icon: 'hammer' },
  AWAITING_CLARIFICATION: { label: 'Ожидает уточнения', color: '#A6742F', bg: '#FDF6EC', icon: 'questionmark.bubble' },
  IMPLEMENTED: { label: 'Реализовано', color: '#398060', bg: '#EDF6F1', icon: 'checkmark.seal' },
  REJECTED: { label: 'Отклонено', color: '#C6474F', bg: '#FFF0F0', icon: 'xmark.octagon' },
  CLOSED: { label: 'Закрыто', color: '#526B80', bg: '#F0F3F6', icon: 'archivebox' },
};

export const typeMeta: Record<TicketType, Meta> = {
  PROBLEM: { label: 'Проблема', icon: 'exclamationmark.triangle', color: '#C6474F', bg: '#FFF0F0' },
  PROPOSAL: { label: 'Предложение', icon: 'lightbulb', color: '#497CAA', bg: '#EEF5FC' },
  PRAISE: { label: 'Положительный отзыв', icon: 'hand.thumbsup', color: '#997137', bg: '#FCF7EC' },
};

export const priorityMeta: Record<Priority, { label: string; color: string; bg: string }> = {
  HIGH: { label: 'Высокий', color: '#ED151C', bg: '#ED151C12' },
  MEDIUM: { label: 'Средний', color: '#A6742F', bg: '#FDF6EC' },
  LOW: { label: 'Низкий', color: '#526B80', bg: '#F0F3F6' },
};

export const roleLabel: Record<Role, string> = {
  EMPLOYEE: 'Сотрудник',
  MANAGER: 'Руководитель',
  ADMIN: 'Администратор',
};

/** Допустимые переходы — копия серверной матрицы (сервер остаётся источником истины). */
export const transitions: Record<Status, Status[]> = {
  NEW: ['IN_REVIEW', 'IN_PROGRESS', 'AWAITING_CLARIFICATION', 'REJECTED'],
  IN_REVIEW: ['IN_PROGRESS', 'AWAITING_CLARIFICATION', 'IMPLEMENTED', 'REJECTED'],
  IN_PROGRESS: ['AWAITING_CLARIFICATION', 'IMPLEMENTED', 'REJECTED'],
  AWAITING_CLARIFICATION: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED'],
  IMPLEMENTED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

export const finalStatuses: Status[] = ['IMPLEMENTED', 'REJECTED', 'CLOSED'];

export function formatDate(value: string | null | undefined, withTime = false) {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function relative(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return '';
  const diff = (Date.now() - date.getTime()) / 1000;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const fmt = (n: number, forms: [string, string, string]) => {
    const n10 = n % 10;
    const n100 = n % 100;
    const form = n10 === 1 && n100 !== 11 ? forms[0] : n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? forms[1] : forms[2];
    return `${n} ${form}`;
  };
  let text: string;
  if (abs < 60) return 'только что';
  if (abs < 3600) text = fmt(Math.floor(abs / 60), ['минуту', 'минуты', 'минут']);
  else if (abs < 86400) text = fmt(Math.floor(abs / 3600), ['час', 'часа', 'часов']);
  else if (abs < 86400 * 30) text = fmt(Math.floor(abs / 86400), ['день', 'дня', 'дней']);
  else return formatDate(value);
  return future ? `через ${text}` : `${text} назад`;
}
