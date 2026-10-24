import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });

export const metadata: Metadata = {
  title: { default: 'Sell your API to agents', template: '%s · Misa' },
  description: 'Turn a subscription API into one AI agents pay for per call.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#040a12',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fonts = [GeistSans.variable, GeistMono.variable, bricolage.variable].join(' ');
  return (
    // Misa is dark only (Deep sea); the class turns on shadcn/ui's `dark:` styles.
    <html lang="en" className={`dark ${fonts}`}>
      <body className="min-h-dvh overflow-x-hidden font-sans">
        {/* Ambient light: a Misa-blue glow top left, a Sky glow right, and film grain over them. */}
        <div
          aria-hidden
          className="misa-ambient pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden"
        >
          <div className="absolute -top-[260px] -left-[160px] size-[620px] rounded-full bg-misa-blue opacity-35 blur-[140px]" />
          <div className="absolute -top-[180px] -right-[200px] size-[520px] rounded-full bg-misa-sky opacity-20 blur-[140px]" />
        </div>
        <SiteHeader />
        <main className="relative mx-auto w-full max-w-6xl px-5 pt-10 pb-24 sm:pt-14">
          {children}
        </main>
        <Toaster position="bottom-left" />
      </body>
    </html>
  );
}
