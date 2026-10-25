/** A small mono status pill (the design system's StatusPill): a 10% wash of the color, its text, and a 30% border. */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const TONES = {
  pass: 'border-pass/30 bg-pass/10 text-pass',
  wait: 'border-wait/30 bg-wait/10 text-wait',
  fail: 'border-fail/30 bg-fail/10 text-fail',
  primary: 'border-primary/30 bg-primary/10 text-primary',
  muted: 'border-border bg-muted text-muted-foreground',
} as const;

export function StatusChip({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONES;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11.5px] leading-4 [&_svg]:size-3',
        TONES[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
