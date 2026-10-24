import { redirect } from 'next/navigation';

import { misa } from '@/lib/misa';
import type { Draft, Session } from '@/lib/misa-client';
import { readSession } from '@/lib/session';

export async function requireSession(): Promise<Session> {
  const session = await readSession();
  if (session === undefined) redirect('/');
  return session;
}

export async function requireDraft(): Promise<Draft> {
  const session = await requireSession();
  return misa().getApi(session);
}
