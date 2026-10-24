import { redirect } from 'next/navigation';

import { FormError } from '@/components/form-message';
import { StepFrame } from '@/components/step-frame';
import { UsageView } from '@/components/usage-view';
import { misa } from '@/lib/misa';
import { MisaRequestError } from '@/lib/misa-client';
import { readSession } from '@/lib/session';

export const metadata = { title: 'Agent usage' };

export default async function UsagePage() {
  const session = await readSession();
  if (session === undefined) redirect('/');
  try {
    const usage = await misa().usage(session);
    return (
      <StepFrame wide kicker="Usage" title="Agent usage" lede="Each call, with its receipt.">
        <UsageView initial={usage} />
      </StepFrame>
    );
  } catch (error) {
    if (error instanceof MisaRequestError) {
      return (
        <StepFrame wide kicker="Usage" title="Agent usage" lede="Each call, with its receipt.">
          <FormError message={error.detail} />
        </StepFrame>
      );
    }
    throw error;
  }
}
