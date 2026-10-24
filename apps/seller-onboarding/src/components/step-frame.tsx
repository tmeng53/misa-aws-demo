import type { ReactNode } from 'react';

import { PageHead } from '@/components/page-head';

export function StepFrame({
  kicker,
  title,
  lede,
  wide = false,
  children,
}: {
  kicker: string;
  title: string;
  lede: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? 'grid min-w-0 gap-10' : 'grid min-w-0 max-w-2xl gap-10'}>
      <PageHead kicker={kicker} title={title} lede={lede} />
      {children}
    </div>
  );
}
