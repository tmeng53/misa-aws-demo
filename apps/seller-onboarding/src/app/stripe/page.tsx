import Link from 'next/link';

import { FormError } from '@/components/form-message';
import { LinkStripeForm } from '@/components/link-stripe-form';
import { Panel } from '@/components/panel';
import { StatusChip } from '@/components/status-chip';
import { StepFrame } from '@/components/step-frame';
import { Button } from '@/components/ui/button';
import { payoutLabel, payoutTone } from '@/lib/copy';
import { requireDraft } from '@/lib/draft';
import { MisaRequestError } from '@/lib/misa-client';

export const metadata = { title: 'Link Stripe' };

const LEDE = 'Agents pay you per call. The money lands in your own Stripe account.';

export default async function StripePage() {
  try {
    const draft = await requireDraft();
    const status = draft.payout_methods[0]?.status ?? 'not_linked';
    return (
      <StepFrame kicker="Step 2 of 4" title="Link Stripe" lede={LEDE}>
        <Panel title="Payout">
          <StatusChip tone={payoutTone(status)}>{payoutLabel(status)}</StatusChip>
          <div className="mt-6">
            {status === 'linked' ? (
              <Button asChild size="lg">
                <Link href="/prices">Continue</Link>
              </Button>
            ) : (
              <LinkStripeForm />
            )}
          </div>
        </Panel>
      </StepFrame>
    );
  } catch (error) {
    if (error instanceof MisaRequestError) {
      return (
        <StepFrame kicker="Step 2 of 4" title="Link Stripe" lede={LEDE}>
          <FormError message={error.detail} />
        </StepFrame>
      );
    }
    throw error;
  }
}
