import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'sprintly-theme';
const listeners = new Set<() => void>();

const read = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(KEY, theme);
  listeners.forEach((l) => l());
}

/** Shared external store so every consumer (topbar, command palette) stays in sync. */
export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => 'light' as Theme,
  );
  const toggle = useCallback(() => apply(read() === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle, setTheme: apply };
}
