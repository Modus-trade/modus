import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onTicketChanged } from './live';
import { ApiError } from './api';
import { useAuth } from './auth';
import { diskKey, memory } from './cache';

/**
 * Загружает данные при каждом показе экрана; поддерживает pull-to-refresh.
 * С `cacheKey` экран открывается сразу с прошлыми данными, а запрос идёт в фоне.
 */
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = [], cacheKey?: string) {
  const { user, logout } = useAuth();
  const key = cacheKey && user ? `${user.id}.${cacheKey}` : null;
  const [data, setData] = useState<T | null>(() => (key ? ((memory.get(key) as T) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const fresh = useRef(false);

  // Новый ключ (другой фильтр, другое обращение): сразу показываем то, что помним.
  useEffect(() => {
    fresh.current = false;
    if (!key) return;
    const cached = memory.get(key) as T | undefined;
    setData(cached ?? null);
    if (cached !== undefined) return;
    AsyncStorage.getItem(diskKey(key))
      .then((raw) => {
        if (!raw || fresh.current) return;
        const value = JSON.parse(raw) as T;
        memory.set(key, value);
        setData(value);
      })
      .catch(() => undefined);
  }, [key]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async (manual = false) => {
    const id = ++seq.current;
    if (manual) setRefreshing(true);
    try {
      const result = await loader();
      if (id === seq.current) {
        fresh.current = true;
        setData(result);
        setError(null);
        if (key) {
          memory.set(key, result);
          AsyncStorage.setItem(diskKey(key), JSON.stringify(result)).catch(() => undefined);
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return logout();
      // Если прошлые данные уже на экране, ошибку сети не показываем.
      if (id === seq.current && !(key && memory.has(key))) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      if (id === seq.current) setRefreshing(false);
    }
  }, [...deps, key]);

  // Живое событие с сервера — тихо перечитываем данные экрана.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onTicketChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(() => load(), 300);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, error, refreshing, reload: load, refresh: () => load(true), setData };
}
