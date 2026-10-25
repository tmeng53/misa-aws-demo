'use client';
/** A form's submit button: shows the thinking orb and a working label while the action runs. */
import type { ComponentProps, ReactNode } from 'react';

import { PendingOrb } from '@/components/pending-orb';
import { Button } from '@/components/ui/button';

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, 'type'> & {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <PendingOrb className="size-4" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
