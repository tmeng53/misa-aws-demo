'use client';
/** A header link that shows when you're in its section. */
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function NavLink({
  href,
  except,
  children,
}: {
  href: Route;
  /** A sub-section with its own link, where this one isn't active. */
  except?: Route;
  children: ReactNode;
}) {
  const path = usePathname();
  const within = (base: string) => path === base || path.startsWith(`${base}/`);
  const active = within(href) && (except === undefined || !within(except));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-lg px-3 py-1.5 transition-colors',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}
