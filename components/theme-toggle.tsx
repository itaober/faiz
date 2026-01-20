'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const ThemeToggle = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <button className="size-5 opacity-0" aria-label="Toggle Theme">
        <div className="size-5" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <motion.button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <motion.div initial={false} animate={{ rotate: isDark ? 0 : 180 }}>
        {isDark ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
      </motion.div>
    </motion.button>
  );
};

export default ThemeToggle;
