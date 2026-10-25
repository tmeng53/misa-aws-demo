'use client';
/** The thinking orb, on Misa's dark ground, for work in progress (a form being submitted). */
import { ThinkingOrb } from 'thinking-orbs';

export function PendingOrb({ className }: { className?: string }) {
  return (
    <ThinkingOrb
      state="working"
      size={20}
      theme="dark"
      className={className ?? 'size-5'}
      aria-hidden
    />
  );
}
