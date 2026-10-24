// A stand-in for the Misa service's seller onboarding API, for building the
// screens locally. It keeps everything in memory and follows the contract's
// shapes; it does not proxy, check or settle real calls.
//
//   node scripts/stub-misa.mjs            # http://localhost:4020
//
// Point the app at it with MISA_SERVICE_URL=http://localhost:4020.

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 4020);
const PUBLIC = `http://localhost:${PORT}`;
const MIN_PRICE = 0.5;

const sellers = new Map(); // token -> { id, name, email, stripe }
const apis = new Map(); // api_id -> { draft, sellerToken }

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' });
  res.end(JSON.stringify(body));
};
const problem = (res, status, detail, reason = 'STUB_ERROR') =>
  send(res, status, { type: 'about:blank', title: 'Request failed', status, detail, reason });

const readJson = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(undefined);
      }
    });
  });

async function plansFromPricingPage(url) {
  const html = await (await fetch(url)).text();
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!match) return [];
  const ld = JSON.parse(match[1]);
  return (ld.offers ?? [])
    .filter((o) => o.priceSpecification?.billingDuration === 'P1M')
    .map((o) => ({
      name: o.name,
      price_usd_month: Number(o.priceSpecification.price),
      calls_per_month: Number(o.priceSpecification.eligibleQuantity?.value ?? o.eligibleQuantity?.value),
      source: 'pricing_page',
    }));
}

function draftPrice(plans) {
  const paid = plans.filter((p) => p.price_usd_month > 0 && p.calls_per_month > 0);
  if (paid.length === 0) return { price: MIN_PRICE.toFixed(2), reason: `No paid plans found: the rail minimum, $${MIN_PRICE.toFixed(2)}` };
  const top = paid.reduce((a, b) => (a.price_usd_month / a.calls_per_month >= b.price_usd_month / b.calls_per_month ? a : b));
  const unit = Math.ceil((top.price_usd_month / top.calls_per_month) * 1000) / 1000;
  const price = Math.max(unit, MIN_PRICE);
  const base = `${top.name} plan: $${top.price_usd_month} / ${top.calls_per_month.toLocaleString('en-US')} calls = $${unit.toFixed(3)}`;
  return { price: price.toFixed(2), reason: unit < MIN_PRICE ? `${base}, raised to the payment minimum $${MIN_PRICE.toFixed(2)}` : base };
}

function draftView(api) {
  const seller = [...sellers.values()].find((s) => s.id === api.draft.seller.id);
  const linked = seller?.stripe === 'linked';
  return {
    ...api.draft,
    payout_methods: [{ kind: 'stripe_account', status: seller?.stripe ?? 'not_linked', accepts: ['card', 'usdc_base'] }],
    payment_options: linked ? [{ protocol: 'x402', scheme: 'exact', network: 'eip155:84532', asset: 'USDC' }] : [],
  };
}

function fakeUsage(api) {
  const ops = api.draft.operations.filter((o) => o.enabled);
  const recent = Array.from({ length: Math.min(api.calls, 50) }, (_, i) => {
    const n = api.calls - i;
    const failed = n % 3 === 0;
    const op = ops[n % ops.length] ?? api.draft.operations[0];
    return {
      receipt_id: randomUUID(),
      operation_id: op.operation_id,
      at: new Date(Date.now() - i * 40_000).toISOString(),
      price_usd: op.price_usd,
      check: failed ? 'failed' : 'passed',
      failed_checks: failed ? [n % 2 ? 'not_empty' : 'status_2xx'] : [],
      charged: !failed,
      buyer: `0x${(n * 7919).toString(16).padStart(40, 'a')}`,
      latency_ms: 300 + ((n * 37) % 200),
      door: 'http',
      channel: n % 2 ? 'agent_tool_hubs' : 'misa_catalog',
    };
  });
  const charged = recent.filter((r) => r.charged);
  const revenue = charged.reduce((s, r) => s + Number(r.price_usd), 0);
  return {
    totals: {
      calls: recent.length,
      charged: charged.length,
      refused_by_check: recent.length - charged.length,
      revenue_usd: revenue.toFixed(2),
      unique_buyers: new Set(recent.map((r) => r.buyer)).size,
      avg_latency_ms: recent.length ? Math.round(recent.reduce((s, r) => s + r.latency_ms, 0) / recent.length) : 0,
    },
    by_operation: api.draft.operations.map((o) => {
      const rows = recent.filter((r) => r.operation_id === o.operation_id);
      const ok = rows.filter((r) => r.charged);
      return { operation_id: o.operation_id, calls: rows.length, charged: ok.length, revenue_usd: ok.reduce((s, r) => s + Number(r.price_usd), 0).toFixed(2) };
    }),
    recent,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', PUBLIC);
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const seller = sellers.get(token);
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

  if (req.method === 'POST' && url.pathname === '/v1/apis') {
    const body = await readJson(req);
    if (!body?.openapi_url || !body?.upstream_auth?.value || !body?.seller?.email) {
      return problem(res, 400, 'Give your OpenAPI URL, an API key for Misa, and your email.', 'INVALID_INPUT');
    }
    let doc;
    try {
      doc = await (await fetch(body.openapi_url)).json();
    } catch {
      return problem(res, 422, `Misa could not read an OpenAPI description at ${body.openapi_url}.`, 'OPENAPI_UNREADABLE');
    }
    const plans = body.plans?.length
      ? body.plans.map((p) => ({ ...p, source: 'seller' }))
      : body.pricing_url
        ? await plansFromPricingPage(body.pricing_url).catch(() => [])
        : [];
    const { price, reason } = draftPrice(plans);
    let sellerToken = token && seller ? token : randomUUID();
    if (!sellers.has(sellerToken)) sellers.set(sellerToken, { id: randomUUID(), ...body.seller, stripe: 'not_linked' });
    const s = sellers.get(sellerToken);
    const apiId = randomUUID();
    const slug = String(doc.info?.title ?? 'api').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const operations = Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
      Object.entries(item).map(([method, op]) => ({
        operation_id: op.operationId,
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? '',
        price_usd: price,
        price_reason: reason,
        enabled: true,
      })),
    );
    const draft = {
      api_id: apiId,
      slug,
      status: 'draft',
      name: doc.info?.title ?? slug,
      description: doc.info?.description ?? '',
      seller: { id: s.id, name: s.name, email: s.email },
      upstream: { base_url: doc.servers?.[0]?.url ?? '', openapi_url: body.openapi_url, auth: { type: 'header', name: body.upstream_auth.name } },
      channels: { misa_catalog: true, agent_tool_hubs: true },
      plans,
      operations,
      checks: [
        { name: 'status_2xx', description: 'Seller answered with a success status' },
        { name: 'json', description: 'The answer is JSON' },
        { name: 'schema', description: "The answer matches the seller's OpenAPI schema" },
        { name: 'not_empty', description: 'The answer is not empty' },
      ],
      door_url: null,
      listing_url: null,
      openapi_url: null,
    };
    const api = { draft, calls: 0 };
    apis.set(apiId, api);
    return send(res, 201, { api_id: apiId, slug, seller_id: s.id, seller_token: sellerToken, draft: draftView(api) });
  }

  if (req.method === 'POST' && url.pathname === '/v1/sellers/me/stripe/link') {
    if (!seller) return problem(res, 401, 'Sign in again: your seller token was not recognised.', 'SELLER_TOKEN_REQUIRED');
    const body = (await readJson(req)) ?? {};
    // The stub "links" at once and sends the browser straight back.
    seller.stripe = 'linked';
    return send(res, 200, { url: body.return_url ?? `${PUBLIC}/` });
  }

  if (parts[0] === 'v1' && parts[1] === 'apis' && parts[2]) {
    const api = apis.get(parts[2]);
    if (!api) return problem(res, 404, 'No API with that id.', 'API_NOT_FOUND');
    if (!seller || seller.id !== api.draft.seller.id) return problem(res, 401, 'Sign in again: your seller token was not recognised.', 'SELLER_TOKEN_REQUIRED');

    if (req.method === 'GET' && parts.length === 3) return send(res, 200, draftView(api));

    if (req.method === 'PATCH' && parts.length === 3) {
      const body = await readJson(req);
      if (!body) return problem(res, 400, 'The body is not JSON.', 'INVALID_INPUT');
      if (typeof body.description === 'string') api.draft.description = body.description;
      if (body.channels) api.draft.channels = { ...api.draft.channels, ...body.channels };
      for (const change of body.operations ?? []) {
        const op = api.draft.operations.find((o) => o.operation_id === change.operation_id);
        if (!op) return problem(res, 400, `No operation ${change.operation_id}.`, 'INVALID_INPUT');
        if (change.price_usd !== undefined) {
          if (!/^\d+(\.\d{1,3})?$/.test(change.price_usd) || Number(change.price_usd) < MIN_PRICE) {
            return problem(res, 400, `Prices are dollars like 0.50, at least $${MIN_PRICE.toFixed(2)}.`, 'PRICE_TOO_LOW');
          }
          op.price_usd = change.price_usd;
          op.price_reason = 'Set by you';
        }
        if (typeof change.enabled === 'boolean') op.enabled = change.enabled;
      }
      return send(res, 200, draftView(api));
    }

    if (req.method === 'POST' && parts[3] === 'publish') {
      if (seller.stripe !== 'linked') return problem(res, 409, 'Link Stripe before you publish, so agents have a way to pay you.', 'PAYOUT_NOT_LINKED');
      if (!api.draft.operations.some((o) => o.enabled)) return problem(res, 409, 'Turn on at least one operation.', 'NOTHING_TO_SELL');
      api.draft.status = 'live';
      api.draft.door_url = `${PUBLIC}/x/${api.draft.slug}`;
      api.draft.listing_url = `${PUBLIC}/x/${api.draft.slug}`;
      api.draft.openapi_url = `${PUBLIC}/x/${api.draft.slug}/openapi.json`;
      return send(res, 200, { door_url: api.draft.door_url, listing_url: api.draft.listing_url, openapi_url: api.draft.openapi_url });
    }

    if (req.method === 'GET' && parts[3] === 'usage') {
      // Each read adds a simulated call once live, so the usage view has something to show.
      if (api.draft.status === 'live') api.calls += 1;
      return send(res, 200, fakeUsage(api));
    }
  }

  return problem(res, 404, 'Not in the stub.', 'NOT_FOUND');
});

server.listen(PORT, () => console.log(`Stub Misa service on ${PUBLIC}`));
