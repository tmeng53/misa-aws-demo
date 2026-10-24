import { cookies } from 'next/headers';

import type { Session } from '@/lib/misa-client';
import { openSession, sealSession } from '@/lib/seal';

const COOKIE = 'misa_seller';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function readSession(): Promise<Session | undefined> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (value === undefined) return undefined;
  return openSession(value, sessionSecret());
}

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, await sealSession(session, sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret === undefined || secret.length === 0) throw new Error('SESSION_SECRET is not set');
  return secret;
}
