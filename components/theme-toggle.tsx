'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { ANIMATION } from '@/lib/constants/animation';

const ThemeToggle = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <button className="icon-button size-7 opacity-0" aria-label="Toggle Theme">
        <div className="size-5" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <motion.button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="focus-ring icon-button hover:bg-muted/70 size-7 text-current"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      aria-pressed={isDark}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 0 : 180 }}
        transition={{ duration: ANIMATION.duration.normal, ease: ANIMATION.ease.out }}
      >
        {isDark ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
      </motion.div>
    </motion.button>
  );
};

export default ThemeToggle;
