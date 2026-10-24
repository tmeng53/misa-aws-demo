/** A page's heading block (the design system's SectionHead): a mono Sky kicker, a Bricolage headline, a lede. */
import type { ReactNode } from 'react';

export function PageHead({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: string;
  lede?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[12px] leading-4 tracking-[0.14em] text-secondary uppercase">
        {kicker}
      </p>
      <h1 className="mt-4 max-w-[18ch] font-display text-[clamp(34px,4.6vw,56px)] leading-[1.04] font-bold tracking-[-0.025em] text-balance break-words">
        {title}
      </h1>
      {lede !== undefined && (
        <div className="mt-3 max-w-[36em] text-[17px] leading-[1.625] text-muted-foreground">
          {lede}
        </div>
      )}
    </div>
  );
}
