import type { ReactNode } from 'react';

/** A mono, uppercase label over a block, as the header of a receipt. */
export function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <h4 className="font-mono text-[11.5px] leading-4 tracking-[0.12em] text-muted-foreground uppercase">
      {children}
    </h4>
  );
}
