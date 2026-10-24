import { AS_OF, COMPANIES, SECTORS, type Company, type Quarter } from "./companies.js";

// The answers Fernbrook's API gives, as plain JSON-ready objects. Money is in
// US dollars; ratios are fractions (0.18 = 18%).

const findCompany = (ticker: string) => COMPANIES.find((c) => c.ticker === ticker.toUpperCase());

const last = <T>(items: readonly T[]): T | undefined => items[items.length - 1];

function marketCap(c: Company): number {
  return Math.round(c.price * c.sharesOutstanding);
}

function summary(c: Company, baseUrl: string) {
  return {
    ticker: c.ticker,
    name: c.name,
    sector: c.sector,
    industry: c.industry,
    exchange: c.exchange,
    market_cap_usd: marketCap(c),
    url: `${baseUrl}/v1/companies/${c.ticker}`,
  };
}

export function searchCompanies(input: { q?: string; sector?: string; limit: number }, baseUrl: string) {
  const q = input.q?.trim().toLowerCase() ?? "";
  const matches = COMPANIES.filter(
    (c) =>
      (!input.sector || c.sector === input.sector) &&
      (!q ||
        c.ticker.toLowerCase() === q ||
        [c.name, c.industry, c.sector, c.description].some((field) => field.toLowerCase().includes(q))),
  ).sort((a, b) => marketCap(b) - marketCap(a));
  return {
    query: input.q ?? "",
    total: matches.length,
    results: matches.slice(0, input.limit).map((c) => summary(c, baseUrl)),
  };
}

export function getCompany(ticker: string, baseUrl: string) {
  const c = findCompany(ticker);
  if (!c) return undefined;
  const next = c.estimates[0];
  return {
    ...summary(c, baseUrl),
    description: c.description,
    headquarters: c.headquarters,
    employees: c.employees,
    shares_outstanding: c.sharesOutstanding,
    share_price_usd: c.price,
    last_reported_period: last(c.quarters)?.fiscalPeriod ?? null,
    next_report_date: next?.reportDate ?? null,
  };
}

function sumQuarters(quarters: readonly Quarter[]) {
  return {
    revenue: quarters.reduce((s, q) => s + q.revenue, 0),
    grossProfit: quarters.reduce((s, q) => s + q.grossProfit, 0),
    operatingIncome: quarters.reduce((s, q) => s + q.operatingIncome, 0),
    netIncome: quarters.reduce((s, q) => s + q.netIncome, 0),
    eps: Math.round(quarters.reduce((s, q) => s + q.epsDiluted, 0) * 100) / 100,
  };
}

export function getFinancials(ticker: string, input: { period: "quarter" | "annual"; limit: number }) {
  const c = findCompany(ticker);
  if (!c) return undefined;
  const rows =
    input.period === "quarter"
      ? c.quarters.map((q) => ({
          fiscal_period: q.fiscalPeriod,
          period_end: q.periodEnd,
          revenue: q.revenue,
          gross_profit: q.grossProfit,
          operating_income: q.operatingIncome,
          net_income: q.netIncome,
          eps_diluted: q.epsDiluted,
        }))
      : [2023, 2024, 2025].map((year) => {
          const t = sumQuarters(c.quarters.filter((q) => q.fiscalPeriod.startsWith(`${year}-`)));
          return {
            fiscal_period: `${year}`,
            period_end: `${year}-12-31`,
            revenue: t.revenue,
            gross_profit: t.grossProfit,
            operating_income: t.operatingIncome,
            net_income: t.netIncome,
            eps_diluted: t.eps,
          };
        });
  return {
    ticker: c.ticker,
    currency: "USD",
    period: input.period,
    results: rows.reverse().slice(0, input.limit),
  };
}

export function getEstimates(ticker: string) {
  const c = findCompany(ticker);
  if (!c) return undefined;
  return {
    ticker: c.ticker,
    as_of: AS_OF,
    results: c.estimates.map((e) => ({
      fiscal_period: e.fiscalPeriod,
      report_date: e.reportDate,
      eps_consensus: e.eps.consensus,
      eps_high: e.eps.high,
      eps_low: e.eps.low,
      revenue_consensus: e.revenue.consensus,
      revenue_high: e.revenue.high,
      revenue_low: e.revenue.low,
      analyst_count: e.eps.count,
    })),
  };
}

const surprise = (actual: number, expected: number) => (expected === 0 ? 0 : Math.round(((actual - expected) / Math.abs(expected)) * 1000) / 10);

export function getEarnings(ticker: string, limit: number) {
  const c = findCompany(ticker);
  if (!c) return undefined;
  return {
    ticker: c.ticker,
    results: [...c.quarters]
      .reverse()
      .slice(0, limit)
      .map((q) => ({
        fiscal_period: q.fiscalPeriod,
        reported_at: q.reportedAt,
        eps_actual: q.epsDiluted,
        eps_consensus: q.epsConsensus,
        eps_surprise_pct: surprise(q.epsDiluted, q.epsConsensus),
        revenue_actual: q.revenue,
        revenue_consensus: q.revenueConsensus,
        revenue_surprise_pct: surprise(q.revenue, q.revenueConsensus),
      })),
  };
}

export function earningsCalendar(input: { from: string; to: string; sector?: string }) {
  const results = COMPANIES.flatMap((c) =>
    c.estimates
      .filter((e) => e.reportDate >= input.from && e.reportDate <= input.to && (!input.sector || c.sector === input.sector))
      .map((e) => ({
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        fiscal_period: e.fiscalPeriod,
        report_date: e.reportDate,
        eps_consensus: e.eps.consensus,
        revenue_consensus: e.revenue.consensus,
      })),
  ).sort((a, b) => a.report_date.localeCompare(b.report_date) || a.ticker.localeCompare(b.ticker));
  return { from: input.from, to: input.to, total: results.length, results };
}

export const COMPARE_METRICS = ["revenue_growth_yoy", "gross_margin", "net_margin", "eps_growth_yoy", "market_cap_usd"] as const;
export type CompareMetric = (typeof COMPARE_METRICS)[number];

export function isCompareMetric(value: string): value is CompareMetric {
  return (COMPARE_METRICS as readonly string[]).includes(value);
}

function metricValue(c: Company, metric: CompareMetric): number {
  const recent = c.quarters.slice(-4);
  const yearAgo = c.quarters.slice(-8, -4);
  const now = sumQuarters(recent);
  const before = sumQuarters(yearAgo);
  const ratio = (n: number) => Math.round(n * 1000) / 1000;
  switch (metric) {
    case "revenue_growth_yoy":
      return ratio(now.revenue / before.revenue - 1);
    case "gross_margin":
      return ratio(now.grossProfit / now.revenue);
    case "net_margin":
      return ratio(now.netIncome / now.revenue);
    case "eps_growth_yoy":
      return before.eps === 0 ? 0 : ratio(now.eps / before.eps - 1);
    case "market_cap_usd":
      return marketCap(c);
  }
}

export function compareSector(sector: string, metric: CompareMetric) {
  const info = SECTORS.find((s) => s.slug === sector);
  if (!info) return undefined;
  const results = COMPANIES.filter((c) => c.sector === sector)
    .map((c) => ({ ticker: c.ticker, name: c.name, value: metricValue(c, metric) }))
    .sort((a, b) => b.value - a.value)
    .map((row, i) => ({ rank: i + 1, ...row }));
  const values = results.map((r) => r.value).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? (values[mid] ?? 0) : ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2;
  return {
    sector: info.slug,
    sector_name: info.name,
    metric,
    basis: metric === "market_cap_usd" ? `as of ${AS_OF}` : "trailing four quarters to 2026-Q2",
    median: Math.round(median * 1000) / 1000,
    results,
  };
}

export function listSectors() {
  return {
    results: SECTORS.map((s) => ({
      slug: s.slug,
      name: s.name,
      company_count: COMPANIES.filter((c) => c.sector === s.slug).length,
    })),
  };
}
