'use client';
/** Fades and lifts content in on first render, staggered by `index` (the prototypes' entrance). */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function Appear({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const still = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0.15, duration: 0.5, delay: Math.min(index, 8) * 0.05 }}
    >
      {children}
    </motion.div>
  );
}
