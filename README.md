# Misa AWS demo

A seller who sells an API the human way (monthly plans, API keys, a pricing page) becomes buyable by AI agents, pay per call, without writing code.

| Folder | What |
| --- | --- |
| `apps/seller-api` | **Fernbrook Fundamentals API**, a fictional company-data seller modeled on real financial data APIs: company profiles, financials, consensus earnings estimates, earnings history, an earnings calendar and sector comparisons, keyed by stock ticker. Sold on monthly or annual plans with an API key. |
| `apps/seller-onboarding` | The seller's side of Misa: paste your API, approve per-call prices, link Stripe, go live, watch agent usage. Calls the hosted Misa service. |

Fernbrook is invented for this demo. Every company, ticker and figure in it is made up.

## Run locally

Node 22 and pnpm.

```sh
pnpm install
cp apps/seller-api/.env.example apps/seller-api/.env   # fill in values
pnpm dev:api          # http://localhost:4010
pnpm test
```

## Fernbrook Fundamentals API

| Path | What |
| --- | --- |
| `GET /pricing` | Free $0 / 100 calls, Starter $29 / 2,000, Pro $99 / 10,000 a month (yearly: $290, $990). schema.org `Product` JSON-LD in the page, also at `/pricing.json` |
| `GET /signup` | Get an API key (plans are simulated, no card) |
| `GET /companies` | Coverage: every company and ticker |
| `GET /openapi.json` | OpenAPI 3.0.3, auth by `X-API-Key` header |
| `GET /v1/companies?q=&sector=` | Search companies |
| `GET /v1/companies/{ticker}` | Profile, share price, next report date |
| `GET /v1/companies/{ticker}/financials?period=quarter\|annual` | Income statement figures |
| `GET /v1/companies/{ticker}/estimates` | Consensus EPS and revenue for the next two quarters |
| `GET /v1/companies/{ticker}/earnings` | Past quarters against consensus, with surprise % |
| `GET /v1/calendar?from=&to=&sector=` | Earnings calendar (default: 14 days from 2026-10-24) |
| `GET /v1/sectors`, `GET /v1/sectors/{sector}/compare?metric=` | Sectors, and peer rankings |
| `GET /console`, `POST /admin/fault` | The bad-day switch, guarded by `PROVIDER_ADMIN_TOKEN` |

Bad-day modes for `POST /admin/fault` (`{"mode": "..."}`): `none` (healthy), `empty` (200 with `{"results":[]}`), `malformed` (200 with HTML), `error` (500), `slow` (20 s wait).

```sh
curl -X POST "$PROVIDER_URL/admin/fault" -H "Authorization: Bearer $PROVIDER_ADMIN_TOKEN" \
  -H "content-type: application/json" -d '{"mode":"empty"}'
```
