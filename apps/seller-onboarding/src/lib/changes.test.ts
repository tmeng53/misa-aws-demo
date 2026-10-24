import { describe, expect, it } from 'vitest';

import { priceChanges } from './changes';
import type { Draft } from './misa-client';

function draft(): Draft {
  return {
    api_id: 'api',
    slug: 'sample',
    status: 'draft',
    name: 'Sample Data API',
    description: 'Company facts.',
    seller: { id: 'seller', name: 'Ada Example', email: 'ada@example.com' },
    upstream: { base_url: 'https://example.com', openapi_url: 'https://example.com/openapi.json', auth: { type: 'header', name: 'X-API-Key' } },
    payout_methods: [{ kind: 'stripe_account', status: 'not_linked', accepts: ['card', 'usdc_base'] }],
    payment_options: [],
    channels: { misa_catalog: true, agent_tool_hubs: true },
    plans: [{ name: 'Individual', price_usd_month: 25, calls_per_month: 50, source: 'pricing_page' }],
    operations: [
      {
        operation_id: 'getEstimates',
        method: 'GET',
        path: '/v1/companies/{ticker}/estimates',
        summary: 'Estimates',
        price_usd: '0.50',
        price_reason: 'Individual plan: $25 / 50 calls = $0.500',
        enabled: true,
      },
    ],
    checks: [{ name: 'not_empty', description: 'The answer is not empty' }],
    door_url: null,
    listing_url: null,
    openapi_url: null,
  };
}

describe('priceChanges', () => {
  it('sends nothing when the seller kept the drafted prices', () => {
    const current = draft();
    const operation = current.operations[0];
    if (operation === undefined) throw new Error('missing operation');
    expect(priceChanges(current, { description: current.description, operations: [{ operation_id: operation.operation_id, price_usd: '0.50', enabled: true }] })).toEqual({});
    expect(priceChanges(current, { description: current.description, operations: [{ operation_id: operation.operation_id, price_usd: '0.5', enabled: true }] })).toEqual({});
  });

  it('sends a price under the minimum so Misa can refuse it', () => {
    const current = draft();
    expect(priceChanges(current, { description: current.description, operations: [{ operation_id: 'getEstimates', price_usd: '0.10', enabled: true }] })).toEqual({
      operations: [{ operation_id: 'getEstimates', price_usd: '0.10' }],
    });
    expect(priceChanges(current, { description: current.description, operations: [{ operation_id: 'getEstimates', price_usd: '$0.60', enabled: true }] })).toEqual({
      operations: [{ operation_id: 'getEstimates', price_usd: '0.60' }],
    });
  });

  it('sends only the switch when the price is unchanged', () => {
    const current = draft();
    expect(priceChanges(current, { description: 'A new description', operations: [{ operation_id: 'getEstimates', price_usd: '0.50', enabled: false }] })).toEqual({
      description: 'A new description',
      operations: [{ operation_id: 'getEstimates', enabled: false }],
    });
  });

  it('asks for a price when the field is blank', () => {
    const current = draft();
    expect(priceChanges(current, { description: current.description, operations: [{ operation_id: 'getEstimates', price_usd: '  ', enabled: true }] })).toEqual({
      detail: 'Enter a price in dollars, like 0.50.',
    });
  });
});
