import { useEffect } from 'react';
import { useAppSelector } from '@/redux/store';

export function useTheme() {
  const theme = useAppSelector((s) => s.ui.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);
  return theme;
}
