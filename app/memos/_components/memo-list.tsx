'use client';

import { motion } from 'motion/react';

import { ANIMATION } from '@/lib/constants/animation';

export default function MemoList({ children }: { children: React.ReactNode }) {
  return (
    <motion.article
      className="prose dark:prose-invert"
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: ANIMATION.stagger.normal } },
      }}
    >
      {children}
    </motion.article>
  );
}
