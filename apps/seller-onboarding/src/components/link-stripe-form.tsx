'use client';

import { useActionState } from 'react';

import { FormError } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { linkStripe } from '@/lib/actions';

export function LinkStripeForm() {
  const [state, action, pending] = useActionState(linkStripe, undefined);

  return (
    <form action={action} className="grid gap-4">
      <FormError message={state?.detail} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Opening Stripe" size="lg">
          Link Stripe
        </SubmitButton>
      </div>
    </form>
  );
}
