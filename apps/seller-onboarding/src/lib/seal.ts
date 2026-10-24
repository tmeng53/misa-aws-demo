import type { Session } from '@/lib/misa-client';

// AES-GCM seals the seller session so the cookie value is signed and the
// token is not readable in the browser. The key is SHA-256(SESSION_SECRET),
// which accepts the short local secret as well as a long production one.

type SealedBody = { v: 1; apiId: string; token: string };

export async function sealSession(session: Session, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(secret);
  const plain = new TextEncoder().encode(JSON.stringify({ v: 1, apiId: session.apiId, token: session.token } satisfies SealedBody));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return `v1.${encode(iv)}.${encode(cipher)}`;
}

export async function openSession(sealed: string, secret: string): Promise<Session | undefined> {
  const parts = sealed.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return undefined;
  const ivPart = parts[1];
  const cipherPart = parts[2];
  if (ivPart === undefined || cipherPart === undefined) return undefined;
  try {
    const iv = bufferFrom(decode(ivPart));
    const cipher = bufferFrom(decode(cipherPart));
    if (iv.byteLength !== 12) return undefined;
    const key = await aesKey(secret);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plain));
    if (!isSealedBody(parsed)) return undefined;
    return { apiId: parsed.apiId, token: parsed.token };
  } catch {
    return undefined;
  }
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function bufferFrom(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function decode(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isSealedBody(value: unknown): value is SealedBody {
  if (typeof value !== 'object' || value === null) return false;
  if (!('v' in value) || !('apiId' in value) || !('token' in value)) return false;
  return value.v === 1 && typeof value.apiId === 'string' && value.apiId.length > 0 && typeof value.token === 'string' && value.token.length > 0;
}
