import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onTicketChanged } from './live';
import { ApiError } from './api';
import { useAuth } from './auth';

/** Загружает данные при каждом показе экрана; поддерживает pull-to-refresh. */
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const { logout } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async (manual = false) => {
    const id = ++seq.current;
    if (manual) setRefreshing(true);
    try {
      const result = await loader();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return logout();
      if (id === seq.current) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      if (id === seq.current) setRefreshing(false);
    }
  }, deps);

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
