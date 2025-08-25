'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const isDark = theme === 'dark';

  return (
    <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="">
      {isDark ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
    </button>
  );
};

export default ThemeToggle;
