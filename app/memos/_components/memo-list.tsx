'use client';

import { motion } from 'motion/react';


export default function MemoList({ children }: { children: React.ReactNode }) {
  return (
    <motion.article className="prose dark:prose-invert" initial={false} animate="visible">
      {children}
    </motion.article>
  );
}
