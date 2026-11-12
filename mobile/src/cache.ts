import AsyncStorage from '@react-native-async-storage/async-storage';

// Последние данные каждого экрана: показываем их сразу, свежие подтягиваем в фоне.
// В памяти — на время работы приложения, на диске — между запусками.
export const memory = new Map<string, unknown>();
export const diskKey = (key: string) => `modus.cache.${key}`;

/** Забыть все сохранённые данные (при выходе из аккаунта). */
export async function clearDataCache() {
  memory.clear();
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('modus.cache.'));
  await AsyncStorage.multiRemove(keys);
}

