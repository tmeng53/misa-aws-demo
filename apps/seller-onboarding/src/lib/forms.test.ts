import { describe, expect, it } from 'vitest';

import { connectInput } from './forms';

const fields = {
  name: 'Ada Example',
  email: 'ada@example.com',
  openapiUrl: 'https://example.com/openapi.json',
  pricingUrl: 'https://example.com/pricing',
  apiKey: 'super-secret-key',
  headerName: '',
};

describe('connectInput', () => {
  it('builds the create-api body and defaults the header name', () => {
    expect(connectInput(fields)).toEqual({
      seller: { name: 'Ada Example', email: 'ada@example.com' },
      openapi_url: 'https://example.com/openapi.json',
      pricing_url: 'https://example.com/pricing',
      upstream_auth: { type: 'header', name: 'X-API-Key', value: 'super-secret-key' },
    });
  });

  it('omits an empty pricing page', () => {
    const input = connectInput({ ...fields, pricingUrl: '  ' });
    expect(input).not.toHaveProperty('pricing_url');
  });

  it('returns a message that does not include the API key', () => {
    const error = connectInput({ ...fields, openapiUrl: 'not a url' });
    expect(error).toEqual({ detail: 'Enter a valid OpenAPI URL.' });
    expect(JSON.stringify(error)).not.toContain('super-secret-key');
  });
});
