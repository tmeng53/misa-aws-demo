'use client';

import { useActionState, useState } from 'react';

import { FormError } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { Checkbox } from '@/components/ui/checkbox';
import { goLive } from '@/lib/actions';
import type { Channels } from '@/lib/misa-client';

const CHOICES = [
  { name: 'misa_catalog', label: 'Misa catalog: agents searching Misa find you' },
  { name: 'agent_tool_hubs', label: 'Agent tool hubs: listed where agent builders pick tools' },
] as const;

export function PublishForm({ channels }: { channels: Channels }) {
  const [state, action, pending] = useActionState(goLive, undefined);
  const [selected, setSelected] = useState<Channels>(channels);

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="misa_catalog" value={selected.misa_catalog ? '1' : '0'} />
      <input type="hidden" name="agent_tool_hubs" value={selected.agent_tool_hubs ? '1' : '0'} />
      <ul className="grid gap-3">
        {CHOICES.map((choice) => (
          <li key={choice.name}>
            <label className="flex items-start gap-3 rounded-2xl border px-4 py-3">
              <Checkbox
                checked={selected[choice.name]}
                onCheckedChange={(checked) => setSelected((current) => ({ ...current, [choice.name]: checked === true }))}
                aria-label={choice.label}
                className="mt-0.5"
              />
              <span className="text-sm leading-6">{choice.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <FormError message={state?.detail} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Publishing" size="lg">
          Go live
        </SubmitButton>
      </div>
    </form>
  );
}
