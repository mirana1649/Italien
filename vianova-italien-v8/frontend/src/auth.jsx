import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null); // XP, série de jours, badges (étudiants)
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));
  const refreshStats = useCallback(() => api('/student/stats').then(setStats).catch(() => {}), []);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (user?.role === 'student') refreshStats(); else setStats(null); }, [user, refreshStats]);

  const start = ({ token, user }) => { localStorage.setItem('token', token); setUser(user); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  return <Ctx.Provider value={{ user, loading, start, logout, stats, refreshStats }}>{children}</Ctx.Provider>;
}
