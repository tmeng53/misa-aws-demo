import { httpMisaClient, type MisaClient } from '@/lib/misa-client';

let client: MisaClient | undefined;

/** One client for the process. Call Misa only from server code. */
export function misa(): MisaClient {
  const baseUrl = process.env.MISA_SERVICE_URL;
  if (baseUrl === undefined || baseUrl.length === 0) throw new Error('MISA_SERVICE_URL is not set');
  client ??= httpMisaClient(baseUrl);
  return client;
}
