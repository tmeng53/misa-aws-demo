import type { Draft, DraftChanges } from '@/lib/misa-client';

export type PriceEdit = {
  description: string;
  operations: { operation_id: string; price_usd: string; enabled: boolean }[];
};

export type ChangeError = { detail: string };

/** The PATCH body for a price review: only fields the seller actually changed. */
export function priceChanges(draft: Draft, edit: PriceEdit): DraftChanges | ChangeError {
  if (edit.operations.length !== draft.operations.length) {
    return { detail: 'Refresh the page and review the prices again.' };
  }
  const changes: DraftChanges = {};
  if (edit.description !== draft.description) changes.description = edit.description;

  const operations: NonNullable<DraftChanges['operations']> = [];
  for (const next of edit.operations) {
    const current = draft.operations.find((operation) => operation.operation_id === next.operation_id);
    if (current === undefined) return { detail: `No operation ${next.operation_id}.` };
    const price = normalizePrice(next.price_usd);
    if (price.length === 0) return { detail: 'Enter a price in dollars, like 0.50.' };
    const patch: { operation_id: string; price_usd?: string; enabled?: boolean } = { operation_id: next.operation_id };
    if (!samePrice(current.price_usd, price)) patch.price_usd = price;
    if (next.enabled !== current.enabled) patch.enabled = next.enabled;
    if (patch.price_usd !== undefined || patch.enabled !== undefined) operations.push(patch);
  }
  if (operations.length > 0) changes.operations = operations;
  return changes;
}

export function normalizePrice(value: string): string {
  return value.trim().replace(/^\$/, '').trim();
}

function samePrice(current: string, next: string): boolean {
  if (current === next) return true;
  if (!/^\d+(\.\d{1,3})?$/.test(next)) return false;
  const left = Number(current);
  const right = Number(next);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}
