import { headers } from 'next/headers';

/** The browser origin of this request, for Stripe return and refresh URLs. */
export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  if (host === null || host.length === 0) throw new Error('The request has no host.');
  const forwarded = headerList.get('x-forwarded-proto');
  const proto = forwarded ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}
