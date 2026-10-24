/** The header: the Misa wordmark and where the seller is in onboarding. */
import Link from 'next/link';

import { NavLink } from '@/components/nav-link';

const STEPS = [
  { href: '/', label: 'Connect', n: '1' },
  { href: '/stripe', label: 'Stripe', n: '2' },
  { href: '/prices', label: 'Prices', n: '3' },
  { href: '/publish', label: 'Go live', n: '4' },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-3 sm:h-16 sm:flex-row sm:items-center sm:gap-6 sm:py-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display text-[26px] leading-[1.2] font-bold tracking-[-0.025em] text-foreground">
            misa
          </Link>
          <span className="font-mono text-[12px] tracking-[0.14em] text-secondary uppercase">Sell to agents</span>
        </div>
        <nav aria-label="Onboarding steps" className="flex flex-wrap items-center gap-1 text-sm sm:ml-auto">
          {STEPS.map((step) => (
            <NavLink key={step.href} href={step.href}>
              <span className="font-mono">{step.n}</span> {step.label}
            </NavLink>
          ))}
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <NavLink href="/usage">Usage</NavLink>
        </nav>
      </div>
    </header>
  );
}
