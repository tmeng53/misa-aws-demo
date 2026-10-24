import { httpMisaClient, type MisaClient } from '@/lib/misa-client';

/** Hosted Misa. `MISA_SERVICE_URL` overrides this for the local stub. */
const DEMO_MISA_URL = 'https://api.trymisa.com';

let client: MisaClient | undefined;

/** One client for the process. Call Misa only from server code. */
export function misa(): MisaClient {
  const configured = process.env.MISA_SERVICE_URL?.replace(/\/+$/, '');
  const baseUrl = configured !== undefined && configured.length > 0 ? configured : DEMO_MISA_URL;
  client ??= httpMisaClient(baseUrl);
  return client;
}
