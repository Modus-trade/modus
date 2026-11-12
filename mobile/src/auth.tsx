import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type User } from './api';
import { clearDataCache } from './cache';

const USER_KEY = 'modus.user';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Сразу открываем приложение под последним пользователем, сессию проверяем в фоне.
    AsyncStorage.getItem(USER_KEY)
      .then((raw) => {
        if (raw && !cancelled) {
          setUser(JSON.parse(raw));
          setReady(true);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        api
          .me()
          .then((me) => {
            if (cancelled) return;
            setUser(me);
            AsyncStorage.setItem(USER_KEY, JSON.stringify(me)).catch(() => undefined);
          })
          .catch((e) => {
            // Сессия истекла — на вход. Нет сети — остаёмся с сохранённым пользователем.
            if (cancelled || !(e instanceof ApiError && e.status === 401)) return;
            setUser(null);
            AsyncStorage.removeItem(USER_KEY).catch(() => undefined);
            clearDataCache().catch(() => undefined);
          })
          .finally(() => !cancelled && setReady(true));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await api.login(email.trim(), password);
    setUser(me);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(me)).catch(() => undefined);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    await AsyncStorage.removeItem(USER_KEY).catch(() => undefined);
    await clearDataCache().catch(() => undefined);
  }, []);

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth вне AuthProvider');
  return value;
}

export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new ApiError(401, 'Войдите в систему');
  return user;
}

export const isManager = (user: User | null) => !!user && user.role !== 'EMPLOYEE';
