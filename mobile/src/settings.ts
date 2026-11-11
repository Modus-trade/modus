import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoHaptics from 'expo-haptics';
import { useEffect, useState } from 'react';

// Настройки приложения на этом телефоне.
export interface Settings {
  haptics: boolean;
  updates: boolean; // уведомлять о новых ответах/уточнениях при открытии приложения
}

const KEY = 'modus.settings';
let current: Settings = { haptics: true, updates: true };
const listeners = new Set<(s: Settings) => void>();

export const settingsReady = AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw) current = { ...current, ...JSON.parse(raw) };
    listeners.forEach((l) => l(current));
  })
  .catch(() => undefined);

export function getSettings() {
  return current;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  current = { ...current, [key]: value };
  listeners.forEach((l) => l(current));
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => undefined);
}

export function useSettings() {
  const [s, setS] = useState(current);
  useEffect(() => {
    listeners.add(setS);
    setS(current);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

/** Вибрация с учётом настройки. API совпадает с expo-haptics. */
export const Haptics = {
  NotificationFeedbackType: ExpoHaptics.NotificationFeedbackType,
  ImpactFeedbackStyle: ExpoHaptics.ImpactFeedbackStyle,
  selectionAsync: () => (current.haptics ? ExpoHaptics.selectionAsync().catch(() => undefined) : Promise.resolve()),
  impactAsync: (style?: ExpoHaptics.ImpactFeedbackStyle) =>
    current.haptics ? ExpoHaptics.impactAsync(style).catch(() => undefined) : Promise.resolve(),
  notificationAsync: (type?: ExpoHaptics.NotificationFeedbackType) =>
    current.haptics ? ExpoHaptics.notificationAsync(type).catch(() => undefined) : Promise.resolve(),
};
