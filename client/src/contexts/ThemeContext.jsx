import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export const themes = [
  { id: 'sage', name: 'Sage', colors: ['#174D43', '#D5EBDF'] },
  { id: 'ocean', name: 'Ocean', colors: ['#155E75', '#CFFAFE'] },
  { id: 'berry', name: 'Berry', colors: ['#9D174D', '#FCE7F3'] },
  { id: 'lavender', name: 'Lavender', colors: ['#6D28D9', '#EDE9FE'] },
  { id: 'sunset', name: 'Sunset', colors: ['#C2410C', '#FFEDD5'] },
  { id: 'forest', name: 'Forest', colors: ['#3F6212', '#ECFCCB'] },
  { id: 'midnight', name: 'Midnight', colors: ['#334155', '#E2E8F0'] },
  { id: 'rose', name: 'Rose', colors: ['#BE123C', '#FFE4E6'] },
];

const ThemeContext = createContext(null);
const storageKey = userId => `familyplate.theme.v1:${userId || 'guest'}`;

export function ThemeProvider({ children }) {
  const user = useAuthStore(state => state.user);
  const key = storageKey(user?.id);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(key) || 'sage'; } catch { return 'sage'; }
  });

  useEffect(() => {
    let saved = 'sage';
    try { saved = localStorage.getItem(key) || 'sage'; } catch {}
    setTheme(themes.some(item => item.id === saved) ? saved : 'sage');
  }, [key]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(key, theme); } catch {}
  }, [key, theme]);

  const value = useMemo(() => ({ theme, setTheme, themes }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
