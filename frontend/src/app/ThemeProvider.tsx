import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeContextValue } from './themeStore';
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY, isThemeId, themeById, type ThemeId } from './themes';

function initialThemeId(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

/** Theme selection only changes CSS custom properties — never data or behaviour. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(initialThemeId);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeId;
    root.style.colorScheme = themeId === 'midnight' ? 'dark' : 'light';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      /* storage may be disabled; theme still applies for this session */
    }
  }, [themeId]);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, theme: themeById(themeId), setThemeId }),
    [themeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
