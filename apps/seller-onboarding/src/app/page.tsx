import { ConnectForm } from '@/components/connect-form';
import { Panel } from '@/components/panel';
import { StepFrame } from '@/components/step-frame';

export default function ConnectPage() {
  return (
    <StepFrame
      kicker="Step 1 of 4"
      title="Connect your API"
      lede="Paste the API you already sell. We'll draft a per-call price from your plans."
    >
      <Panel title="Your API" description="Misa reads your OpenAPI description and, if you share it, your pricing page.">
        <ConnectForm />
      </Panel>
    </StepFrame>
  );
}
