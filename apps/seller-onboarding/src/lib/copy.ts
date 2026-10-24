import type { Draft, Plan, Usage } from '@/lib/misa-client';

export type RecentCall = Usage['recent'][number];

export type PaySummary = { kind: 'needs_stripe' } | { kind: 'ready'; text: string };

export type PayoutStatus = Draft['payout_methods'][number]['status'];

export type PricesView = {
  name: string;
  description: string;
  plans: Plan[];
  operations: Draft['operations'];
  checks: Draft['checks'];
  pay: PaySummary;
  payoutStatus: PayoutStatus;
};

const CHECK_PHRASE: Record<string, string> = {
  not_empty: 'empty answer',
  status_2xx: 'error status',
  json: 'not JSON',
  schema: 'wrong shape',
};

const CHECK_TITLE: Record<string, string> = {
  not_empty: 'Not empty',
  status_2xx: 'Success status',
  json: 'JSON',
  schema: 'Matches your schema',
};

export function checkPhrase(name: string): string {
  return CHECK_PHRASE[name] ?? name.replaceAll('_', ' ');
}

export function checkTitle(name: string): string {
  return CHECK_TITLE[name] ?? name.replaceAll('_', ' ');
}

/** `0xabc…1234`: five characters, an ellipsis, then the last four. */
export function shortBuyer(buyer: string): string {
  if (buyer.length <= 12) return buyer;
  return `${buyer.slice(0, 5)}…${buyer.slice(-4)}`;
}

export function formatCallTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function wholeDollars(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function countLabel(amount: number): string {
  return amount.toLocaleString('en-US');
}

export function planSource(source: Plan['source']): string {
  return source === 'pricing_page' ? 'from your pricing page' : 'typed by you';
}

export function channelLabel(channel: string): string {
  if (channel === 'misa_catalog') return 'Misa catalog';
  if (channel === 'agent_tool_hubs') return 'Agent tool hubs';
  return channel.replaceAll('_', ' ');
}

export function payoutLabel(status: PayoutStatus): string {
  if (status === 'linked') return 'Linked';
  if (status === 'pending') return 'Pending';
  return 'Not linked';
}

export function payoutTone(status: PayoutStatus): 'pass' | 'wait' | 'muted' {
  if (status === 'linked') return 'pass';
  if (status === 'pending') return 'wait';
  return 'muted';
}

export function howAgentsPay(input: {
  payout_methods: { status: string; accepts: string[] }[];
  payment_options: { asset: string }[];
}): PaySummary {
  const payout = input.payout_methods[0];
  if (payout === undefined || payout.status !== 'linked' || input.payment_options.length === 0) {
    return { kind: 'needs_stripe' };
  }
  const ways: string[] = [];
  const add = (way: string) => {
    if (!ways.includes(way)) ways.push(way);
  };
  const consider = (value: string) => {
    const lower = value.toLowerCase();
    if (lower.includes('usdc')) add('USDC');
    else if (lower === 'card') add('card');
  };
  for (const option of input.payment_options) consider(option.asset);
  for (const accept of payout.accepts) consider(accept);
  const ordered = ['USDC', 'card'].filter((way) => ways.includes(way));
  const via = ordered.length === 2 ? 'USDC or card' : ordered[0] === 'card' ? 'card' : ordered[0] === 'USDC' ? 'USDC' : 'USDC or card';
  const pay = via === 'card' ? 'Agents pay by card' : `Agents pay in ${via}`;
  return { kind: 'ready', text: `Stripe account: linked. ${pay}; you receive dollars.` };
}

export function pricesView(draft: Draft): PricesView {
  const payout = draft.payout_methods[0];
  return {
    name: draft.name,
    description: draft.description,
    plans: draft.plans,
    operations: draft.operations,
    checks: draft.checks,
    payoutStatus: payout?.status ?? 'not_linked',
    pay: howAgentsPay({
      payout_methods: draft.payout_methods.map((method) => ({ status: method.status, accepts: method.accepts })),
      payment_options: draft.payment_options.map((option) => ({ asset: option.asset })),
    }),
  };
}

export function rowFingerprint(row: RecentCall): string {
  return [
    row.buyer,
    row.operation_id,
    row.price_usd,
    row.check,
    row.failed_checks.join(','),
    String(row.latency_ms),
    row.channel,
    row.charged ? 'charged' : 'refused',
  ].join('|');
}

export type AlignedCall = { key: string; row: RecentCall };

/**
 * Keeps a stable key for each call across polls. A real receipt id matches
 * directly. The local stub mints a new receipt id on every read, so a call
 * that is otherwise the same keeps the key it was given the first time.
 */
export function alignUsageRows(previous: AlignedCall[], next: RecentCall[]): AlignedCall[] {
  const unused = new Set(previous.map((item) => item.key));
  const byReceipt = new Map(previous.map((item) => [item.row.receipt_id, item.key]));
  const byPrint = new Map<string, string[]>();
  for (const item of previous) {
    const list = byPrint.get(rowFingerprint(item.row)) ?? [];
    list.push(item.key);
    byPrint.set(rowFingerprint(item.row), list);
  }

  return next.map((row) => {
    const receiptKey = byReceipt.get(row.receipt_id);
    if (receiptKey !== undefined && unused.has(receiptKey)) {
      unused.delete(receiptKey);
      return { key: receiptKey, row };
    }
    const prints = byPrint.get(rowFingerprint(row));
    while (prints !== undefined && prints.length > 0) {
      const key = prints.shift();
      if (key !== undefined && unused.has(key)) {
        unused.delete(key);
        return { key, row };
      }
    }
    return { key: row.receipt_id, row };
  });
}
