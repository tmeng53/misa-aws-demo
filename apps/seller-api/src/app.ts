import { Hono, type Context } from "hono";
import { timingSafeEqual } from "node:crypto";
import { isFaultMode, type FaultMode } from "./fault.js";
import type { FaultStore } from "./fault-store.js";
import { openApiDocument } from "./openapi.js";
import { consolePage, coveragePage, docsPage, homePage, keyPage, pricingJsonLd, pricingPage, signupPage } from "./pages.js";
import { PLANS, findPlan, issueKey, readKey, type PlanId } from "./plans.js";
import { AS_OF, SECTORS } from "./companies.js";
import {
  compareSector,
  earningsCalendar,
  getCompany,
  getEarnings,
  getEstimates,
  getFinancials,
  isCompareMetric,
  listSectors,
  searchCompanies,
} from "./fundamentals.js";

export type AppConfig = {
  // Public base URL. When unset, it is taken from each request.
  publicUrl?: string;
  // Signs self-serve API keys.
  keySecret: string;
  // Extra keys accepted on the Pro plan, e.g. the one given to Misa.
  staticKeys: readonly string[];
  // Guards the fault switch. When unset, the switch is off.
  adminToken?: string;
  faults: FaultStore;
  // Lets tests skip the 20-second wait of the `slow` mode.
  sleep?: (ms: number) => Promise<void>;
};

type Env = { Variables: { plan: PlanId; keyId: string } };

function problem(c: Context, status: 400 | 401 | 404 | 429 | 500, title: string, detail: string) {
  return c.body(JSON.stringify({ type: "about:blank", title, status, detail }), status, {
    "content-type": "application/problem+json",
  });
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function intParam(value: string | undefined): number | undefined | "invalid" {
  if (value === undefined || value === "") return undefined;
  return /^\d+$/.test(value) ? Number(value) : "invalid";
}

export function createApp(config: AppConfig) {
  const app = new Hono<Env>();
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  // Calls used per key this month. Best effort: kept in memory per instance.
  const usage = new Map<string, number>();

  const baseUrl = (c: Context) => config.publicUrl ?? new URL(c.req.url).origin;

  app.get("/", (c) => c.html(homePage()));
  app.get("/companies", (c) => c.html(coveragePage()));
  app.get("/pricing", (c) => c.html(pricingPage(baseUrl(c))));
  app.get("/pricing.json", (c) => c.json(pricingJsonLd(baseUrl(c))));
  app.get("/docs", (c) => c.html(docsPage(baseUrl(c))));
  app.get("/openapi.json", (c) => c.json(openApiDocument(baseUrl(c))));
  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/signup", (c) => c.html(signupPage(c.req.query("plan") ?? "starter")));
  app.post("/signup", async (c) => {
    const form = await c.req.parseBody();
    const email = typeof form.email === "string" ? form.email.trim() : "";
    const planId = typeof form.plan === "string" ? form.plan : "";
    const plan = findPlan(planId);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !plan) {
      return problem(c, 400, "Invalid sign-up", "Give a valid email and pick a plan.");
    }
    return c.html(keyPage({ email, plan, key: issueKey(config.keySecret, plan.id), baseUrl: baseUrl(c) }));
  });

  // The fault switch.
  app.get("/console", async (c) => c.html(consolePage(await config.faults.get())));
  app.use("/admin/*", async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!config.adminToken || !token || !sameSecret(token, config.adminToken)) {
      return problem(c, 401, "Unauthorized", "Send the admin token as a bearer token.");
    }
    await next();
  });
  app.get("/admin/fault", async (c) => c.json({ mode: await config.faults.get() }));
  app.post("/admin/fault", async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const mode = typeof body === "object" && body !== null && "mode" in body ? body.mode : undefined;
    if (!isFaultMode(mode)) {
      return problem(c, 400, "Invalid mode", "mode must be one of none, empty, malformed, error, slow.");
    }
    await config.faults.set(mode);
    return c.json({ mode });
  });

  // The paid API: key check, monthly quota, then the fault switch.
  app.use("/v1/*", async (c, next) => {
    const key = c.req.header("x-api-key") ?? "";
    const known = config.staticKeys.find((k) => sameSecret(k, key));
    const parsed = known ? { plan: "pro" as const, keyId: `static-${config.staticKeys.indexOf(known)}` } : readKey(config.keySecret, key);
    if (!parsed) {
      return problem(c, 401, "Unauthorized", "Send a valid API key in the X-API-Key header. Get one at /signup.");
    }
    const limit = PLANS.find((p) => p.id === parsed.plan)?.requestsPerMonth ?? 0;
    const used = usage.get(parsed.keyId) ?? 0;
    if (used >= limit) {
      return problem(c, 429, "Monthly limit reached", `Your ${parsed.plan} plan includes ${limit} calls a month. Upgrade at /pricing.`);
    }
    usage.set(parsed.keyId, used + 1);
    c.set("plan", parsed.plan);
    c.set("keyId", parsed.keyId);

    const mode: FaultMode = await config.faults.get();
    switch (mode) {
      case "none":
        return next();
      case "empty":
        return c.json({ results: [] });
      case "malformed":
        return c.body("<html><body>Service temporarily unavailable</body></html>", 200, { "content-type": "text/html" });
      case "error":
        return problem(c, 500, "Internal error", "Something went wrong on our side.");
      case "slow":
        await sleep(20_000);
        return next();
    }
  });

  const limitParam = (c: Context, fallback: number, max: number) => {
    const limit = intParam(c.req.query("limit")) ?? fallback;
    return limit === "invalid" || limit < 1 || limit > max ? undefined : limit;
  };
  const badLimit = (c: Context, max: number) => problem(c, 400, "Invalid limit", `limit is a whole number from 1 to ${max}.`);
  const noCompany = (c: Context) => problem(c, 404, "Not found", "No company has that ticker. Search with /v1/companies?q=.");
  const sectorParam = (c: Context) => c.req.query("sector") || undefined;
  const knownSector = (slug: string | undefined) => !slug || SECTORS.some((s) => s.slug === slug);
  const badSector = (c: Context) => problem(c, 400, "Invalid sector", `sector is one of ${SECTORS.map((s) => s.slug).join(", ")}.`);

  app.get("/v1/companies", (c) => {
    const limit = limitParam(c, 10, 50);
    if (limit === undefined) return badLimit(c, 50);
    const sector = sectorParam(c);
    if (!knownSector(sector)) return badSector(c);
    const q = c.req.query("q");
    if (q && q.length > 100) return problem(c, 400, "Invalid query", "q is at most 100 characters.");
    return c.json(searchCompanies({ q, sector, limit }, baseUrl(c)));
  });

  app.get("/v1/companies/:ticker", (c) => {
    const company = getCompany(c.req.param("ticker"), baseUrl(c));
    return company ? c.json(company) : noCompany(c);
  });

  app.get("/v1/companies/:ticker/financials", (c) => {
    const period = c.req.query("period") ?? "quarter";
    if (period !== "quarter" && period !== "annual") return problem(c, 400, "Invalid period", "period is quarter or annual.");
    const limit = limitParam(c, 8, 20);
    if (limit === undefined) return badLimit(c, 20);
    const financials = getFinancials(c.req.param("ticker"), { period, limit });
    return financials ? c.json(financials) : noCompany(c);
  });

  app.get("/v1/companies/:ticker/estimates", (c) => {
    const estimates = getEstimates(c.req.param("ticker"));
    return estimates ? c.json(estimates) : noCompany(c);
  });

  app.get("/v1/companies/:ticker/earnings", (c) => {
    const limit = limitParam(c, 8, 14);
    if (limit === undefined) return badLimit(c, 14);
    const earnings = getEarnings(c.req.param("ticker"), limit);
    return earnings ? c.json(earnings) : noCompany(c);
  });

  app.get("/v1/calendar", (c) => {
    const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
    const from = c.req.query("from") || AS_OF;
    const to = c.req.query("to") || new Date(Date.parse(`${from}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10);
    if (!isDate(from) || !isDate(to) || to < from) return problem(c, 400, "Invalid dates", "from and to are dates (YYYY-MM-DD), from first.");
    const sector = sectorParam(c);
    if (!knownSector(sector)) return badSector(c);
    return c.json(earningsCalendar({ from, to, sector }));
  });

  app.get("/v1/sectors", (c) => c.json(listSectors()));

  app.get("/v1/sectors/:sector/compare", (c) => {
    const metric = c.req.query("metric") ?? "";
    if (!isCompareMetric(metric)) {
      return problem(c, 400, "Invalid metric", "metric is one of revenue_growth_yoy, gross_margin, net_margin, eps_growth_yoy, market_cap_usd.");
    }
    const ranking = compareSector(c.req.param("sector"), metric);
    return ranking ? c.json(ranking) : problem(c, 404, "Not found", "No sector has that slug. See /v1/sectors.");
  });

  app.notFound((c) => problem(c, 404, "Not found", "No such page. See /docs."));
  app.onError((err, c) => {
    console.error(err);
    return problem(c, 500, "Internal error", "Something went wrong on our side.");
  });

  return app;
}
