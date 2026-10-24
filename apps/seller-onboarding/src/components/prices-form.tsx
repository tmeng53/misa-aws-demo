'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { FormError } from '@/components/form-message';
import { MonoLabel } from '@/components/mono-label';
import { Panel } from '@/components/panel';
import { StatusChip } from '@/components/status-chip';
import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { savePrices } from '@/lib/actions';
import { checkTitle, countLabel, payoutLabel, payoutTone, planSource, wholeDollars, type PricesView } from '@/lib/copy';
import type { Operation } from '@/lib/misa-client';

export function PricesForm({ view }: { view: PricesView }) {
  const [state, action, pending] = useActionState(savePrices, undefined);
  const [description, setDescription] = useState(view.description);
  const [rows, setRows] = useState(view.operations);

  function update(operationId: string, patch: Partial<Pick<Operation, 'price_usd' | 'enabled'>>) {
    setRows((current) => current.map((row) => (row.operation_id === operationId ? { ...row, ...patch } : row)));
  }

  return (
    <form action={action} className="grid min-w-0 gap-6">
      <Panel title={view.name} description="Shown to agents with your API.">
        <Textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-label="Description"
          rows={4}
          maxLength={4000}
        />
      </Panel>

      <Panel title="Your plans" description="The monthly plans we read, and the per-call price they suggest.">
        {view.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plans yet. Per-call prices use the minimum until you set them.</p>
        ) : (
          <>
          <ul className="grid gap-4 sm:hidden">
            {view.plans.map((plan) => (
              <li key={plan.name} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
                <p className="font-medium">{plan.name}</p>
                <p className="mt-1 font-mono text-sm">
                  {wholeDollars(plan.price_usd_month)} / month · {countLabel(plan.calls_per_month)} calls
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{planSource(plan.source)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Per month</TableHead>
                <TableHead>Calls a month</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.plans.map((plan) => (
                <TableRow key={plan.name}>
                  <TableCell className="whitespace-normal">{plan.name}</TableCell>
                  <TableCell className="font-mono">{wholeDollars(plan.price_usd_month)}</TableCell>
                  <TableCell className="font-mono">{countLabel(plan.calls_per_month)}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{planSource(plan.source)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </Panel>

      <Panel title="Per-call prices" description="What an agent pays each time it calls. Turn off anything you don't want to sell.">
        <div className="grid gap-5">
          {rows.map((operation) => {
            const priceId = `price-${operation.operation_id}`;
            return (
              <div key={operation.operation_id} className="grid gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center">
                <input type="hidden" name="operation_id" value={operation.operation_id} />
                <input type="hidden" name={`enabled:${operation.operation_id}`} value={operation.enabled ? '1' : '0'} />
                <div className="min-w-0">
                  <p className="font-mono text-[13px] break-all text-foreground">
                    {operation.method} {operation.path}
                  </p>
                  {operation.summary.length > 0 && <p className="mt-1 text-sm">{operation.summary}</p>}
                  <p className="mt-1 text-sm text-muted-foreground">{operation.price_reason}</p>
                </div>
                <div className="relative">
                  <label className="sr-only" htmlFor={priceId}>
                    Price for {operation.method} {operation.path}
                  </label>
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id={priceId}
                    name={`price:${operation.operation_id}`}
                    value={operation.price_usd}
                    onChange={(event) => update(operation.operation_id, { price_usd: event.target.value })}
                    inputMode="decimal"
                    spellCheck={false}
                    className="pl-7 font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={operation.enabled}
                    onCheckedChange={(enabled) => update(operation.operation_id, { enabled })}
                    aria-label={`Sell ${operation.method} ${operation.path}`}
                  />
                  <span className="text-sm text-muted-foreground">{operation.enabled ? 'On' : 'Off'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="How agents pay">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip tone={payoutTone(view.payoutStatus)}>{payoutLabel(view.payoutStatus)}</StatusChip>
        </div>
        {view.pay.kind === 'needs_stripe' ? (
          <p className="mt-4 text-sm">
            <Link href="/stripe" className="text-foreground underline underline-offset-4">
              Link Stripe first
            </Link>
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{view.pay.text}</p>
        )}
      </Panel>

      <Panel title="What Misa checks before you get paid" description="If your answer fails a check, the agent isn't charged.">
        <ul className="grid gap-4">
          {view.checks.map((check) => (
            <li key={check.name}>
              <MonoLabel>{checkTitle(check.name)}</MonoLabel>
              <p className="mt-1 text-sm">{check.description}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <FormError message={state?.detail} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Saving" size="lg">
          Save prices
        </SubmitButton>
      </div>
    </form>
  );
}
