import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { memoryFaultStore } from "../src/fault-store.js";

const BASE = "https://api.fernbrook.test";

function makeApp() {
  const app = createApp({
    publicUrl: BASE,
    keySecret: "test-secret",
    staticKeys: ["misa-key"],
    adminToken: "admin-token",
    faults: memoryFaultStore(),
  });
  return { app };
}

const withKey = { headers: { "X-API-Key": "misa-key" } };

async function setFault(app: ReturnType<typeof makeApp>["app"], mode: string) {
  return app.request("/admin/fault", {
    method: "POST",
    headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
    body: JSON.stringify({ mode }),
  });
}

describe("API keys", () => {
  it("refuses calls without a key, as problem details", async () => {
    const { app } = makeApp();
    const res = await app.request("/v1/companies?q=solar");
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toMatchObject({ status: 401, title: "Unauthorized" });
  });

  it("issues a working key at sign-up and enforces the plan's monthly calls", async () => {
    const { app } = makeApp();
    const page = await app.request("/signup", {
      method: "POST",
      body: new URLSearchParams({ email: "ada@example.com", plan: "individual" }),
    });
    const key = /fb_live_individual_[A-Za-z0-9]{12}_[A-Za-z0-9_-]{22}/.exec(await page.text())?.[0];
    expect(key).toBeDefined();
    const statuses: number[] = [];
    for (let i = 0; i < 51; i++) {
      statuses.push((await app.request("/v1/sectors", { headers: { "X-API-Key": key ?? "" } })).status);
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(42);
    expect(statuses.filter((s) => s === 500)).toHaveLength(8);
    expect(statuses[50]).toBe(429);
  });

  it("rejects a key whose signature was changed", async () => {
    const { app } = makeApp();
    const res = await app.request("/v1/sectors", { headers: { "X-API-Key": "fb_live_professional_AAAAAAAAAAAA_AAAAAAAAAAAAAAAAAAAAAA" } });
    expect(res.status).toBe(401);
  });
});

describe("fundamentals endpoints", () => {
  it("finds a company by what it does", async () => {
    const { app } = makeApp();
    const res = await app.request("/v1/companies?q=solar", withKey);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      query: "solar",
      total: 1,
      results: [
        {
          ticker: "SLRW",
          name: "Solwright Power",
          sector: "energy",
          industry: "Renewable power",
          exchange: "NASDAQ",
          market_cap_usd: 26071000000,
          url: `${BASE}/v1/companies/SLRW`,
        },
      ],
    });
  });

  it("returns a profile for a lower-case ticker and 404s an unknown one", async () => {
    const { app } = makeApp();
    const body = await (await app.request("/v1/companies/qlmr", withKey)).json();
    expect(body).toMatchObject({ ticker: "QLMR", name: "Quillmere Software", last_reported_period: "2026-Q2", next_report_date: "2026-11-03" });
    const missing = await app.request("/v1/companies/ZZZZ", withKey);
    expect(missing.status).toBe(404);
  });

  it("gives past earnings with the surprise against consensus", async () => {
    const { app } = makeApp();
    const body = await (await app.request("/v1/companies/QLMR/earnings?limit=1", withKey)).json();
    expect(body.results).toEqual([
      {
        fiscal_period: "2026-Q2",
        reported_at: "2026-07-30",
        eps_actual: 5.12,
        eps_consensus: 5.35,
        eps_surprise_pct: -4.3,
        revenue_actual: 2844868236,
        revenue_consensus: 2821747573,
        revenue_surprise_pct: 0.8,
      },
    ]);
  });

  it("sums quarters into annual financials", async () => {
    const { app } = makeApp();
    const annual = await (await app.request("/v1/companies/QLMR/financials?period=annual&limit=1", withKey)).json();
    const quarters = await (await app.request("/v1/companies/QLMR/financials?period=quarter&limit=20", withKey)).json();
    const of2025 = quarters.results.filter((q: { fiscal_period: string }) => q.fiscal_period.startsWith("2025-"));
    expect(of2025).toHaveLength(4);
    expect(annual.results[0].fiscal_period).toBe("2025");
    expect(annual.results[0].revenue).toBe(of2025.reduce((s: number, q: { revenue: number }) => s + q.revenue, 0));
    expect(annual.results[0].revenue).toBe(9650234883);
  });

  it("lists upcoming reports in date order, defaulting to two weeks", async () => {
    const { app } = makeApp();
    const body = await (await app.request("/v1/calendar", withKey)).json();
    expect(body.from).toBe("2026-10-24");
    expect(body.to).toBe("2026-11-07");
    expect(body.results[0]).toMatchObject({ ticker: "VNTX", report_date: "2026-10-27", fiscal_period: "2026-Q3", eps_consensus: 0.67 });
    const dates = body.results.map((r: { report_date: string }) => r.report_date);
    expect(dates).toEqual([...dates].sort());
  });

  it("ranks a sector on a metric", async () => {
    const { app } = makeApp();
    const body = await (await app.request("/v1/sectors/software/compare?metric=net_margin", withKey)).json();
    expect(body.median).toBe(0.122);
    expect(body.results.map((r: { ticker: string }) => r.ticker)).toEqual(["QLMR", "BRKW", "HLYO", "VNTX"]);
  });

  it("rejects bad input with 400", async () => {
    const { app } = makeApp();
    await setFault(app, "none");
    expect((await app.request("/v1/companies?limit=99", withKey)).status).toBe(400);
    expect((await app.request("/v1/companies?sector=crypto", withKey)).status).toBe(400);
    expect((await app.request("/v1/sectors/software/compare?metric=vibes", withKey)).status).toBe(400);
    expect((await app.request("/v1/calendar?from=2026-11-10&to=2026-11-01", withKey)).status).toBe(400);
  });
});

describe("intermittent failures", () => {
  async function statuses(app: ReturnType<typeof makeApp>["app"], n: number) {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const res = await app.request("/v1/companies?q=solar", withKey);
      const body = await res.text();
      out.push(res.status === 200 ? (JSON.parse(body).results.length > 0 ? "ok" : "empty") : String(res.status));
    }
    return out;
  }

  it("fails every 3rd call per key, alternating empty and 500", async () => {
    const { app } = makeApp();
    expect(await statuses(app, 6)).toEqual(["ok", "ok", "empty", "ok", "ok", "500"]);
  });

  it("counts each key separately", async () => {
    const { app } = makeApp();
    await statuses(app, 2);
    const page = await app.request("/signup", { method: "POST", body: new URLSearchParams({ email: "b@example.com", plan: "professional" }) });
    const key = /fb_live_professional_[A-Za-z0-9]{12}_[A-Za-z0-9_-]{22}/.exec(await page.text())?.[0] ?? "";
    const other = await app.request("/v1/companies?q=solar", { headers: { "X-API-Key": key } });
    expect((await other.json()).results).toHaveLength(1);
    expect(await statuses(app, 1)).toEqual(["empty"]);
  });

  it("has a hidden override that needs the admin token", async () => {
    const { app } = makeApp();
    expect((await app.request("/admin/fault", { method: "POST", body: JSON.stringify({ mode: "none" }) })).status).toBe(401);
    expect((await setFault(app, "none")).status).toBe(200);
    expect(await statuses(app, 3)).toEqual(["ok", "ok", "ok"]);
    await setFault(app, "always_error");
    expect(await statuses(app, 1)).toEqual(["500"]);
    expect((await setFault(app, "slow")).status).toBe(400);
  });

  it("has no console page", async () => {
    const { app } = makeApp();
    expect((await app.request("/console")).status).toBe(404);
  });
});

describe("machine-readable descriptions", () => {
  it("serves OpenAPI with the X-API-Key scheme and an operationId on every call", async () => {
    const { app } = makeApp();
    const doc = await (await app.request("/openapi.json")).json();
    expect(doc.openapi).toBe("3.0.3");
    expect(doc.servers).toEqual([{ url: BASE }]);
    expect(doc.components.securitySchemes.apiKey).toMatchObject({ type: "apiKey", in: "header", name: "X-API-Key" });
    const ops = Object.values(doc.paths).flatMap((p) => Object.values(p as Record<string, { operationId: string }>));
    expect(ops.map((o) => o.operationId)).toEqual([
      "searchCompanies",
      "getCompany",
      "getFinancials",
      "getEstimates",
      "getEarnings",
      "getEarningsCalendar",
      "listSectors",
      "compareSector",
    ]);
  });

  it("puts schema.org monthly and annual plans in the pricing page", async () => {
    const { app } = makeApp();
    const page = await (await app.request("/pricing")).text();
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page)?.[1] ?? "{}";
    const ld = JSON.parse(json);
    expect(
      ld.offers.map((o: { name: string; priceSpecification: { price: number; billingDuration: string; eligibleQuantity: { value: number } } }) => [
        o.name,
        o.priceSpecification.price,
        o.priceSpecification.billingDuration,
        o.priceSpecification.eligibleQuantity.value,
      ]),
    ).toEqual([
      ["Individual", 25, "P1M", 50],
      ["Professional", 292, "P1M", 1000],
      ["Enterprise", 708, "P1M", 5000],
      ["Individual (annual)", 250, "P1Y", 50],
      ["Professional (annual)", 2920, "P1Y", 1000],
      ["Enterprise (annual)", 7080, "P1Y", 5000],
    ]);
  });
});
