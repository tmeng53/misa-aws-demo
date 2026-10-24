'use client';

import { useActionState, useState } from 'react';

import { Field } from '@/components/field';
import { FormError } from '@/components/form-message';
import { PendingOrb } from '@/components/pending-orb';
import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { draftPrices } from '@/lib/actions';

export function ConnectForm() {
  const [state, action, pending] = useActionState(draftPrices, undefined);
  // Kept in state so a refused draft doesn't wipe what the seller typed.
  // React resets uncontrolled fields when a form action runs.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [openapiUrl, setOpenapiUrl] = useState('');
  const [pricingUrl, setPricingUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [headerName, setHeaderName] = useState('X-API-Key');

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Your name">
          <Input id="name" name="name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="email" label="Your email">
          <Input id="email" name="email" type="email" autoComplete="email" required maxLength={200} value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
      </div>
      <Field id="openapi_url" label="OpenAPI URL">
        <Input
          id="openapi_url"
          name="openapi_url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://example.com/openapi.json"
          required
          value={openapiUrl}
          onChange={(event) => setOpenapiUrl(event.target.value)}
        />
      </Field>
      <Field id="pricing_url" label="Pricing page URL" hint="We read your plans from it to suggest per-call prices.">
        <Input
          id="pricing_url"
          name="pricing_url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://example.com/pricing"
          aria-describedby="pricing_url-hint"
          value={pricingUrl}
          onChange={(event) => setPricingUrl(event.target.value)}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field id="api_key" label="API key" hint="Misa uses this key when it calls your API.">
          <Input
            id="api_key"
            name="api_key"
            type="password"
            autoComplete="off"
            required
            aria-describedby="api_key-hint"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </Field>
        <Field id="header_name" label="Header name">
          <Input
            id="header_name"
            name="header_name"
            spellCheck={false}
            autoComplete="off"
            value={headerName}
            onChange={(event) => setHeaderName(event.target.value)}
          />
        </Field>
      </div>
      {pending && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <PendingOrb />
          Reading your API and drafting prices.
        </div>
      )}
      <FormError message={state?.detail} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Drafting prices" size="lg">
          Draft my agent prices
        </SubmitButton>
      </div>
    </form>
  );
}
