import { PageHead } from '@/components/page-head';
import { Panel } from '@/components/panel';

// Placeholder. Screen 1 ("Connect your API") replaces this; see the brief.
export default function Home() {
  return (
    <div className="grid gap-10">
      <PageHead
        kicker="Sell to agents"
        title="Let AI agents pay for your API, per call."
        lede="Paste your API, approve per-call prices, link Stripe, and you're live."
      />
      <Panel title="Scaffold" description="The onboarding screens are built here.">
        <p className="text-muted-foreground">Design system wired: tokens, fonts, components.</p>
      </Panel>
    </div>
  );
}
