'use client';

import { SearchIcon } from 'lucide-react';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { ANIMATION } from '@/lib/constants/animation';

// Palette (+ MiniSearch) is a separate chunk, loaded only when search opens —
// zero cost on initial page load.
const SearchCommand = dynamic(() => import('./search-command'), { ssr: false });

export default function SearchEntry() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(current => !current);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring icon-button hover:bg-muted/70 size-7 text-current"
        aria-label="Search"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }}
      >
        <SearchIcon className="size-5" />
      </motion.button>
      {open ? <SearchCommand onClose={() => setOpen(false)} /> : null}
    </>
  );
}
