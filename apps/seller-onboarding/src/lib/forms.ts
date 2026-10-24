import type { PriceEdit } from '@/lib/changes';
import type { NewApi } from '@/lib/misa-client';

export type FieldError = { detail: string };

export type ConnectFields = {
  name: string;
  email: string;
  openapiUrl: string;
  pricingUrl: string;
  apiKey: string;
  headerName: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function connectInput(fields: ConnectFields): NewApi | FieldError {
  const name = fields.name.trim();
  const email = fields.email.trim();
  const openapiUrl = fields.openapiUrl.trim();
  const pricingUrl = fields.pricingUrl.trim();
  const apiKey = fields.apiKey.trim();
  const headerName = fields.headerName.trim() || 'X-API-Key';

  if (name.length === 0) return { detail: 'Enter your name.' };
  if (name.length > 120) return { detail: 'Name is too long.' };
  if (!EMAIL.test(email) || email.length > 200) return { detail: 'Enter your email.' };
  if (!isHttpUrl(openapiUrl)) return { detail: 'Enter a valid OpenAPI URL.' };
  if (pricingUrl.length > 0 && !isHttpUrl(pricingUrl)) return { detail: 'Enter a valid pricing page URL.' };
  if (apiKey.length === 0) return { detail: 'Enter an API key for Misa to call your API with.' };
  if (apiKey.length > 500) return { detail: 'That API key is too long.' };
  if (!/^[A-Za-z0-9-]{1,64}$/.test(headerName)) return { detail: 'Header name should look like X-API-Key.' };

  return {
    seller: { name, email },
    openapi_url: openapiUrl,
    ...(pricingUrl.length > 0 ? { pricing_url: pricingUrl } : {}),
    upstream_auth: { type: 'header', name: headerName, value: apiKey },
  };
}

export function readConnectFields(formData: FormData): ConnectFields {
  return {
    name: stringField(formData, 'name'),
    email: stringField(formData, 'email'),
    openapiUrl: stringField(formData, 'openapi_url'),
    pricingUrl: stringField(formData, 'pricing_url'),
    apiKey: stringField(formData, 'api_key'),
    headerName: stringField(formData, 'header_name'),
  };
}

export function priceEdit(formData: FormData): PriceEdit | FieldError {
  const description = formData.get('description');
  if (typeof description !== 'string') return { detail: 'Enter a description.' };
  if (description.length > 4000) return { detail: 'Description is too long.' };
  const operations: PriceEdit['operations'] = [];
  for (const id of formData.getAll('operation_id')) {
    if (typeof id !== 'string' || id.length === 0) return { detail: 'Refresh the page and review the prices again.' };
    const price = formData.get(`price:${id}`);
    const enabled = formData.get(`enabled:${id}`);
    if (typeof price !== 'string' || (enabled !== '1' && enabled !== '0')) {
      return { detail: 'Refresh the page and review the prices again.' };
    }
    operations.push({ operation_id: id, price_usd: price, enabled: enabled === '1' });
  }
  if (operations.length === 0) return { detail: 'Refresh the page and review the prices again.' };
  return { description, operations };
}

export function isFieldError<T extends object>(value: T | FieldError): value is FieldError {
  return 'detail' in value && typeof value.detail === 'string';
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
