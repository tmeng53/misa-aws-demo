'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { priceChanges } from '@/lib/changes';
import { requireSession } from '@/lib/draft';
import { connectInput, isFieldError, priceEdit, readConnectFields } from '@/lib/forms';
import { misa } from '@/lib/misa';
import { MisaRequestError, type Channels, type Usage } from '@/lib/misa-client';
import { requestOrigin } from '@/lib/origin';
import { readSession, writeSession } from '@/lib/session';

type UsageLoad = { ok: true; usage: Usage } | { ok: false; detail: string; reason: 'session' | 'misa' };

export async function draftPrices(_previous: { detail: string } | undefined, formData: FormData): Promise<{ detail: string } | undefined> {
  const input = connectInput(readConnectFields(formData));
  if (isFieldError(input)) return input;
  const existing = await readSession();
  try {
    const created = await misa().createApi(input, existing?.token);
    await writeSession({ apiId: created.api_id, token: created.seller_token });
  } catch (error) {
    return failure(error);
  }
  redirect('/stripe');
}

export async function linkStripe(_previous: { detail: string } | undefined, _formData: FormData): Promise<{ detail: string } | undefined> {
  const session = await requireSession();
  let url: string;
  try {
    const origin = await requestOrigin();
    const linked = await misa().linkStripe(session.token, {
      return_url: `${origin}/prices`,
      refresh_url: `${origin}/stripe`,
    });
    const parsed = safeHttpUrl(linked.url);
    if (parsed === undefined) return { detail: 'Misa did not return a Stripe link. Try again.' };
    url = parsed;
  } catch (error) {
    return failure(error);
  }
  redirect(url);
}

export async function savePrices(_previous: { detail: string } | undefined, formData: FormData): Promise<{ detail: string } | undefined> {
  const session = await requireSession();
  let draft;
  try {
    draft = await misa().getApi(session);
  } catch (error) {
    return failure(error);
  }
  const edit = priceEdit(formData);
  if (isFieldError(edit)) return edit;
  const changes = priceChanges(draft, edit);
  if (isFieldError(changes)) return changes;
  try {
    if (changes.description !== undefined || changes.operations !== undefined) {
      await misa().updateApi(session, changes);
    }
  } catch (error) {
    return failure(error);
  }
  redirect('/publish');
}

export async function goLive(_previous: { detail: string } | undefined, formData: FormData): Promise<{ detail: string } | undefined> {
  const session = await requireSession();
  const channels: Channels = {
    misa_catalog: formData.get('misa_catalog') === '1',
    agent_tool_hubs: formData.get('agent_tool_hubs') === '1',
  };
  try {
    await misa().updateApi(session, { channels });
    await misa().publish(session);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/publish');
  redirect('/publish');
}

export async function loadUsage(): Promise<UsageLoad> {
  const session = await readSession();
  if (session === undefined) return { ok: false, detail: 'Connect your API to see usage.', reason: 'session' };
  try {
    return { ok: true, usage: await misa().usage(session) };
  } catch (error) {
    if (error instanceof MisaRequestError) return { ok: false, detail: error.detail, reason: 'misa' };
    throw error;
  }
}

function failure(error: unknown): { detail: string } {
  if (error instanceof MisaRequestError) return { detail: error.detail };
  throw error;
}

function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
