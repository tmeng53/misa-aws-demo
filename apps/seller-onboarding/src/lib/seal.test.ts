import { describe, expect, it } from 'vitest';

import { openSession, sealSession } from './seal';

const secret = 'dev-only';
const session = { apiId: 'api-1', token: 'seller-token-value' };

describe('sealSession', () => {
  it('round-trips the session and hides the token in the cookie', async () => {
    const sealed = await sealSession(session, secret);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain(session.token);
    expect(sealed).not.toContain(session.apiId);
    expect(await openSession(sealed, secret)).toEqual(session);
  });

  it('rejects a different secret, a tampered value, and junk', async () => {
    const sealed = await sealSession(session, secret);
    expect(await openSession(sealed, 'other-secret')).toBeUndefined();
    expect(await openSession(`${sealed}x`, secret)).toBeUndefined();
    expect(await openSession('nope', secret)).toBeUndefined();
    expect(await openSession('v1.aa.bb', secret)).toBeUndefined();
  });
});
