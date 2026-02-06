'use client';

import { motion } from 'motion/react';

import { ANIMATION } from '@/lib/constants/animation';

export default function MemoItemWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: ANIMATION.distance.small }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ANIMATION.duration.normal, ease: ANIMATION.ease.out }}
    >
      {children}
    </motion.div>
  );
}
