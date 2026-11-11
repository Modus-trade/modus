import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api, type User } from './api';
import { getSettings, settingsReady } from './settings';
import { statusMeta } from './theme';

// Проверка изменений при открытии приложения: сервер не присылает push,
// поэтому сравниваем обращения с тем, что видели в прошлый раз.
type Snapshot = Record<string, string>; // id -> status

/** Запоминает текущие статусы обращений (после живого события, чтобы не дублировать уведомление). */
export async function rememberSnapshot(user: User) {
  const { items } = await api.tickets({ sort: 'updated_at' });
  await AsyncStorage.setItem(`modus.snapshot.${user.id}`, JSON.stringify(Object.fromEntries(items.map((t) => [String(t.id), t.status]))));
}

async function check(user: User) {
  await settingsReady;
  const key = `modus.snapshot.${user.id}`;
  const { items } = await api.tickets({ sort: 'updated_at' });
  const next: Snapshot = Object.fromEntries(items.map((t) => [String(t.id), t.status]));
  const raw = await AsyncStorage.getItem(key);
  await AsyncStorage.setItem(key, JSON.stringify(next));
  if (!raw || !getSettings().updates) return; // первый запуск — только запоминаем

  const prev: Snapshot = JSON.parse(raw);
  const messages: { title: string; body: string; id: number }[] = [];
  for (const t of items) {
    const was = prev[String(t.id)];
    if (!was && t.author_id !== user.id) messages.push({ title: 'Новое обращение', body: t.title, id: t.id });
    else if (was && was !== t.status) {
      const title = t.status === 'AWAITING_CLARIFICATION' && t.author_id === user.id ? 'Вам задали уточняющий вопрос' : `Статус: ${statusMeta[t.status].label}`;
      messages.push({ title, body: t.title, id: t.id });
    }
  }
  if (!messages.length) return;

  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && !(await Notifications.requestPermissionsAsync()).granted) return;
  const list = messages.length > 3 ? [{ title: 'Обновления по обращениям', body: `Изменений: ${messages.length}`, id: 0 }] : messages;
  for (const m of list) {
    await Notifications.scheduleNotificationAsync({ content: { title: m.title, body: m.body, data: { ticketId: m.id } }, trigger: null });
  }
}

export function useUpdateWatcher(user: User | null) {
  useEffect(() => {
    if (!user) return;
    // Разрешение на уведомления спрашиваем сразу — они приходят и вживую, и при открытии.
    settingsReady.then(async () => {
      if (!getSettings().updates) return;
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) await Notifications.requestPermissionsAsync();
    });
    const run = () => check(user).catch(() => undefined);
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [user]);
}
