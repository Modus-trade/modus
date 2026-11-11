import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { API_URL, request, type User } from './api';
import { getSettings, Haptics } from './settings';
import { rememberSnapshot } from './updates';

// Живые события с сервера (тот же WebSocket, что у сайта).
type ServerEvent =
  | { type: 'ticket_changed'; ticket_id: number; reason: string }
  | {
      type: 'notification';
      notification: { id: number; ticket_id: number; ticket_number: string | null; kind: string; message: string };
    };

const listeners = new Set<(ticketId: number) => void>();

/** Подписка экранов на изменения обращений: экран сам перечитает данные. */
export function onTicketChanged(fn: (ticketId: number) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useLiveSocket(user: User | null) {
  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (stopped || retry) return;
      attempt += 1;
      retry = setTimeout(() => {
        retry = undefined;
        connect();
      }, Math.min(15000, 1000 * 2 ** Math.min(attempt, 4)));
    };

    const connect = async () => {
      if (stopped || (ws && ws.readyState <= 1)) return;
      let token: string;
      try {
        token = (await request<{ token: string }>('/api/ws-token')).token;
      } catch {
        return schedule();
      }
      const socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/api/ws?token=${encodeURIComponent(token)}`);
      ws = socket;
      socket.onopen = () => {
        attempt = 0;
        ping = setInterval(() => socket.readyState === 1 && socket.send('ping'), 25000);
      };
      socket.onmessage = (e) => {
        if (e.data === 'pong') return;
        let event: ServerEvent;
        try {
          event = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (event.type === 'ticket_changed') {
          listeners.forEach((l) => l(event.ticket_id));
          // Запоминаем статусы, чтобы проверка при открытии не повторила то же уведомление.
          clearTimeout(snapshotTimer);
          snapshotTimer = setTimeout(() => rememberSnapshot(user).catch(() => undefined), 1500);
        }
        if (event.type === 'notification' && getSettings().updates) {
          const n = event.notification;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Notifications.scheduleNotificationAsync({
            content: { title: n.message, body: n.ticket_number ? `Обращение ${n.ticket_number}` : '', data: { ticketId: n.ticket_id } },
            trigger: null,
          }).catch(() => undefined);
        }
      };
      socket.onclose = () => {
        clearInterval(ping);
        if (ws === socket) ws = null;
        schedule();
      };
      socket.onerror = () => socket.close();
    };

    connect();
    // iOS усыпляет соединение в фоне — при возврате переподключаемся.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') connect();
    });
    return () => {
      stopped = true;
      sub.remove();
      clearTimeout(retry);
      clearTimeout(snapshotTimer);
      clearInterval(ping);
      ws?.close();
    };
  }, [user]);
}
