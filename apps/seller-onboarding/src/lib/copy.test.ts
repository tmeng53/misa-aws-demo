import { describe, expect, it } from 'vitest';

import { alignUsageRows, channelLabel, checkPhrase, formatCallTime, howAgentsPay, planSource, shortBuyer, type RecentCall } from './copy';

function call(patch: Partial<RecentCall> = {}): RecentCall {
  return {
    receipt_id: 'receipt-1',
    operation_id: 'getEstimates',
    at: '2026-10-25T12:00:00Z',
    price_usd: '0.50',
    check: 'passed',
    failed_checks: [],
    charged: true,
    buyer: '0xabc1234567890abcdef1234567890abcdef1234',
    latency_ms: 380,
    door: 'http',
    channel: 'misa_catalog',
    ...patch,
  };
}

describe('seller-facing copy', () => {
  it('shortens a buyer and names checks in plain words', () => {
    expect(shortBuyer('0xabc1234567890abcdef1234567890abcdef1234')).toBe('0xabc…1234');
    expect(shortBuyer('0xabc')).toBe('0xabc');
    expect(checkPhrase('not_empty')).toBe('empty answer');
    expect(checkPhrase('status_2xx')).toBe('error status');
    expect(checkPhrase('json')).toBe('not JSON');
    expect(checkPhrase('schema')).toBe('wrong shape');
    expect(channelLabel('agent_tool_hubs')).toBe('Agent tool hubs');
    expect(planSource('pricing_page')).toBe('from your pricing page');
    expect(planSource('seller')).toBe('typed by you');
    expect(formatCallTime('2026-10-25T15:04:05Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('describes payment without network or protocol codes', () => {
    const ready = howAgentsPay({
      payout_methods: [{ status: 'linked', accepts: ['card', 'usdc_base'] }],
      payment_options: [{ asset: 'USDC' }],
    });
    expect(ready).toEqual({ kind: 'ready', text: 'Stripe account: linked. Agents pay in USDC or card; you receive dollars.' });
    expect(JSON.stringify(ready)).not.toMatch(/x402|eip155|ledger|escrow|transaction|hash/i);

    expect(howAgentsPay({ payout_methods: [{ status: 'not_linked', accepts: ['card'] }], payment_options: [] })).toEqual({ kind: 'needs_stripe' });
  });

  it('keeps row keys when a later read mints new receipt ids', () => {
    const first = alignUsageRows([], [call({ receipt_id: 'r1', buyer: '0xaaa' })]);
    expect(first.map((item) => item.key)).toEqual(['r1']);
    const second = alignUsageRows(first, [call({ receipt_id: 'r2', buyer: '0xbbb' }), call({ receipt_id: 'r9', buyer: '0xaaa' })]);
    expect(second.map((item) => item.key)).toEqual(['r2', 'r1']);
    const same = alignUsageRows(first, [call({ receipt_id: 'r1', buyer: '0xaaa' })]);
    expect(same.map((item) => item.key)).toEqual(['r1']);
  });
});