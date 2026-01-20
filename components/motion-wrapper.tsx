'use client';

import { motion } from 'motion/react';

import { ANIMATION } from '@/lib/constants/animation';

export default function MotionWrapper({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: ANIMATION.distance.small }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -ANIMATION.distance.small }}
      transition={{ duration: ANIMATION.duration.normal, ease: ANIMATION.ease.out, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
