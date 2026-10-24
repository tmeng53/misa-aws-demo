/** A section of a page: a raised card with a hairline border, as the design system's receipts and big cards. */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Shown at the header's right, e.g. a button. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-3xl border bg-card p-6', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[19px] leading-[1.3] font-semibold tracking-[-0.025em]">
            {title}
          </h2>
          {description !== undefined && (
            <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}
