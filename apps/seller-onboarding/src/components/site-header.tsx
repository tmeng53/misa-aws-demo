/** The header: the Misa wordmark and where the seller is in onboarding. */
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:gap-6">
        <Link
          href="/"
          className="font-display text-[26px] leading-[1.2] font-bold tracking-[-0.025em] text-foreground"
        >
          misa
        </Link>
        <span className="font-mono text-[12px] tracking-[0.14em] text-secondary uppercase">Sell to agents</span>
      </div>
    </header>
  );
}
