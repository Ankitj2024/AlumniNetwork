'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get, post } from './api';
import type { Me } from './types';

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setMe(await get<Me>('/auth/me'));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined);
    setMe(null);
    window.location.href = '/login';
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
