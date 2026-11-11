import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';

// Личные заметки и напоминания. Хранятся только на устройстве, отдельно для каждого пользователя.
export interface Note {
  id: string;
  text: string;
  remindAt: string | null; // ISO
  notificationId: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

interface NotesState {
  notes: Note[];
  ready: boolean;
  save: (note: Partial<Note> & { text: string }) => Promise<Note>;
  remove: (id: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
}

const Ctx = createContext<NotesState | null>(null);

async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function schedule(note: Note): Promise<string | null> {
  if (!note.remindAt || note.done) return null;
  const date = new Date(note.remindAt);
  if (date.getTime() <= Date.now()) return null;
  if (!(await ensurePermission())) return null;
  const [title, ...rest] = note.text.trim().split('\n');
  return Notifications.scheduleNotificationAsync({
    content: { title: title || 'Напоминание', body: rest.join(' ').trim() || 'Модус · заметки', data: { noteId: note.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

async function unschedule(id: string | null) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `modus.notes.${user.id}` : null;
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!key) return setNotes([]);
    AsyncStorage.getItem(key)
      .then((raw) => setNotes(raw ? JSON.parse(raw) : []))
      .catch(() => setNotes([]))
      .finally(() => setReady(true));
  }, [key]);

  const persist = useCallback(
    (next: Note[]) => {
      setNotes(next);
      if (key) AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
    },
    [key],
  );

  const save: NotesState['save'] = async (input) => {
    const now = new Date().toISOString();
    const old = notes.find((n) => n.id === input.id);
    const note: Note = {
      id: old?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: input.text,
      remindAt: input.remindAt !== undefined ? input.remindAt : (old?.remindAt ?? null),
      done: input.done ?? old?.done ?? false,
      notificationId: null,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    await unschedule(old?.notificationId ?? null);
    note.notificationId = await schedule(note);
    persist(old ? notes.map((n) => (n.id === note.id ? note : n)) : [note, ...notes]);
    return note;
  };

  const remove = async (id: string) => {
    await unschedule(notes.find((n) => n.id === id)?.notificationId ?? null);
    persist(notes.filter((n) => n.id !== id));
  };

  const toggleDone = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (n) await save({ ...n, done: !n.done });
  };

  return <Ctx.Provider value={{ notes, ready, save, remove, toggleDone }}>{children}</Ctx.Provider>;
}

export function useNotes() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotes вне NotesProvider');
  return v;
}

export function reminderLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86400000);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const date = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : diff === -1 ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
}
