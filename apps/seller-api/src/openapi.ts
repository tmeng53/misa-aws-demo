import { SECTORS } from "./companies.js";
import { COMPARE_METRICS } from "./fundamentals.js";

// The API description a buyer (or Misa) reads to learn what Fernbrook sells.
// OpenAPI 3.0.3, the version most gateways and code generators accept.

const obj = (required: string[], properties: Record<string, unknown>) => ({ type: "object", required, properties });
const str = (description?: string, extra: Record<string, unknown> = {}) => ({ type: "string", ...(description ? { description } : {}), ...extra });
const num = (description?: string) => ({ type: "number", ...(description ? { description } : {}) });
const int = (description?: string) => ({ type: "integer", ...(description ? { description } : {}) });
const date = (description?: string) => str(description, { format: "date" });
const list = (items: unknown, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) });

const json = (description: string, schema: unknown) => ({ description, content: { "application/json": { schema } } });

const problem = {
  description: "Error, as RFC 9457 problem details.",
  content: {
    "application/problem+json": {
      schema: obj(["type", "title", "status"], { type: str(), title: str(), status: int(), detail: str() }),
    },
  },
};

const errors = { "400": problem, "401": problem, "429": problem };
const errorsWith404 = { ...errors, "404": problem };

const tickerParam = {
  name: "ticker",
  in: "path",
  required: true,
  description: "Stock ticker, e.g. QLMR. Case-insensitive.",
  schema: { type: "string", pattern: "^[A-Za-z]{1,5}$" },
};

const sectorSlugs = SECTORS.map((s) => s.slug);

const companySummary = obj(["ticker", "name", "sector", "industry", "exchange", "market_cap_usd", "url"], {
  ticker: str(undefined, { example: "QLMR" }),
  name: str(),
  sector: str("Sector slug.", { enum: sectorSlugs }),
  industry: str(),
  exchange: str(undefined, { enum: ["NYSE", "NASDAQ"] }),
  market_cap_usd: int("Share price times shares outstanding."),
  url: str("Where to fetch the full profile.", { format: "uri" }),
});

const operation = (op: {
  id: string;
  tag: string;
  summary: string;
  description: string;
  parameters?: unknown[];
  ok: unknown;
  errors: Record<string, unknown>;
}) => ({
  get: {
    operationId: op.id,
    tags: [op.tag],
    summary: op.summary,
    description: op.description,
    parameters: op.parameters ?? [],
    responses: { "200": op.ok, ...op.errors },
  },
});

export function openApiDocument(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Fernbrook Fundamentals API",
      version: "1.0.0",
      description:
        "Company fundamentals for US-listed companies, keyed by stock ticker: profiles, quarterly and annual financials, consensus earnings estimates, past earnings with surprises, an earnings calendar and sector comparisons. Money is in US dollars; ratios are fractions (0.18 = 18%). Data as of 2026-10-24. Fernbrook and every company, ticker and figure in it are fictional, made for a demo.",
      contact: { name: "Fernbrook support", email: "support@fernbrook.example" },
    },
    servers: [{ url: baseUrl }],
    security: [{ apiKey: [] }],
    tags: [{ name: "companies" }, { name: "earnings" }, { name: "sectors" }],
    paths: {
      "/v1/companies": operation({
        id: "searchCompanies",
        tag: "companies",
        summary: "Search companies",
        description: "Find companies by name, ticker, industry or what they do, optionally within one sector. Largest companies first.",
        parameters: [
          { name: "q", in: "query", required: false, description: "Text to match, e.g. 'solar' or 'QLMR'.", schema: { type: "string", maxLength: 100 } },
          { name: "sector", in: "query", required: false, schema: { type: "string", enum: sectorSlugs } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
        ],
        ok: json(
          "Matching companies.",
          obj(["query", "total", "results"], { query: str(), total: int("All matches, before the limit."), results: list(companySummary) }),
        ),
        errors,
      }),
      "/v1/companies/{ticker}": operation({
        id: "getCompany",
        tag: "companies",
        summary: "Get a company profile",
        description: "What the company does, where it is based, its size, share price and its next earnings date.",
        parameters: [tickerParam],
        ok: json(
          "The company.",
          obj(
            [...companySummary.required, "description", "headquarters", "employees", "shares_outstanding", "share_price_usd", "last_reported_period", "next_report_date"],
            {
              ...companySummary.properties,
              description: str(),
              headquarters: str(),
              employees: int(),
              shares_outstanding: int(),
              share_price_usd: num(),
              last_reported_period: str("Latest reported quarter, e.g. 2026-Q2."),
              next_report_date: date(),
            },
          ),
        ),
        errors: errorsWith404,
      }),
      "/v1/companies/{ticker}/financials": operation({
        id: "getFinancials",
        tag: "companies",
        summary: "Get income statement figures",
        description: "Revenue, gross profit, operating income, net income and diluted EPS, newest period first. Quarters run 2023-Q1 to 2026-Q2; annual figures cover 2023 to 2025.",
        parameters: [
          tickerParam,
          { name: "period", in: "query", required: false, schema: { type: "string", enum: ["quarter", "annual"], default: "quarter" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 20, default: 8 } },
        ],
        ok: json(
          "Financial statements.",
          obj(["ticker", "currency", "period", "results"], {
            ticker: str(),
            currency: str(undefined, { enum: ["USD"] }),
            period: str(undefined, { enum: ["quarter", "annual"] }),
            results: list(
              obj(["fiscal_period", "period_end", "revenue", "gross_profit", "operating_income", "net_income", "eps_diluted"], {
                fiscal_period: str("e.g. 2026-Q2, or 2025 for a year."),
                period_end: date(),
                revenue: int(),
                gross_profit: int(),
                operating_income: int(),
                net_income: int(),
                eps_diluted: num(),
              }),
            ),
          }),
        ),
        errors: errorsWith404,
      }),
      "/v1/companies/{ticker}/estimates": operation({
        id: "getEstimates",
        tag: "earnings",
        summary: "Get consensus earnings estimates",
        description: "What analysts expect for the next two quarters: consensus, high and low EPS and revenue, the number of analysts, and the report date.",
        parameters: [tickerParam],
        ok: json(
          "Estimates for upcoming quarters.",
          obj(["ticker", "as_of", "results"], {
            ticker: str(),
            as_of: date(),
            results: list(
              obj(
                ["fiscal_period", "report_date", "eps_consensus", "eps_high", "eps_low", "revenue_consensus", "revenue_high", "revenue_low", "analyst_count"],
                {
                  fiscal_period: str(),
                  report_date: date(),
                  eps_consensus: num(),
                  eps_high: num(),
                  eps_low: num(),
                  revenue_consensus: int(),
                  revenue_high: int(),
                  revenue_low: int(),
                  analyst_count: int(),
                },
              ),
            ),
          }),
        ),
        errors: errorsWith404,
      }),
      "/v1/companies/{ticker}/earnings": operation({
        id: "getEarnings",
        tag: "earnings",
        summary: "Get past earnings results",
        description: "Reported EPS and revenue against the consensus for each past quarter, with the surprise in percent. Newest first.",
        parameters: [tickerParam, { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 14, default: 8 } }],
        ok: json(
          "Past earnings.",
          obj(["ticker", "results"], {
            ticker: str(),
            results: list(
              obj(
                ["fiscal_period", "reported_at", "eps_actual", "eps_consensus", "eps_surprise_pct", "revenue_actual", "revenue_consensus", "revenue_surprise_pct"],
                {
                  fiscal_period: str(),
                  reported_at: date(),
                  eps_actual: num(),
                  eps_consensus: num(),
                  eps_surprise_pct: num("Positive means a beat."),
                  revenue_actual: int(),
                  revenue_consensus: int(),
                  revenue_surprise_pct: num(),
                },
              ),
            ),
          }),
        ),
        errors: errorsWith404,
      }),
      "/v1/calendar": operation({
        id: "getEarningsCalendar",
        tag: "earnings",
        summary: "Get the earnings calendar",
        description: "Companies reporting earnings between two dates, with what the consensus expects. Defaults to the 14 days after 2026-10-24.",
        parameters: [
          { name: "from", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "to", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "sector", in: "query", required: false, schema: { type: "string", enum: sectorSlugs } },
        ],
        ok: json(
          "Upcoming reports.",
          obj(["from", "to", "total", "results"], {
            from: date(),
            to: date(),
            total: int(),
            results: list(
              obj(["ticker", "name", "sector", "fiscal_period", "report_date", "eps_consensus", "revenue_consensus"], {
                ticker: str(),
                name: str(),
                sector: str(),
                fiscal_period: str(),
                report_date: date(),
                eps_consensus: num(),
                revenue_consensus: int(),
              }),
            ),
          }),
        ),
        errors,
      }),
      "/v1/sectors": operation({
        id: "listSectors",
        tag: "sectors",
        summary: "List sectors",
        description: "Every sector covered, with how many companies it holds.",
        ok: json(
          "Sectors.",
          obj(["results"], { results: list(obj(["slug", "name", "company_count"], { slug: str(), name: str(), company_count: int() })) }),
        ),
        errors: { "401": problem, "429": problem },
      }),
      "/v1/sectors/{sector}/compare": operation({
        id: "compareSector",
        tag: "sectors",
        summary: "Rank a sector's companies on one metric",
        description:
          "Ranks every company in a sector, highest first, with the sector median. Growth and margins use the trailing four quarters to 2026-Q2.",
        parameters: [
          { name: "sector", in: "path", required: true, schema: { type: "string", enum: sectorSlugs } },
          { name: "metric", in: "query", required: true, schema: { type: "string", enum: [...COMPARE_METRICS] } },
        ],
        ok: json(
          "The ranking.",
          obj(["sector", "sector_name", "metric", "basis", "median", "results"], {
            sector: str(),
            sector_name: str(),
            metric: str(),
            basis: str(),
            median: num(),
            results: list(obj(["rank", "ticker", "name", "value"], { rank: int(), ticker: str(), name: str(), value: num() })),
          }),
        ),
        errors: errorsWith404,
      }),
    },
    components: {
      securitySchemes: {
        apiKey: { type: "apiKey", in: "header", name: "X-API-Key", description: "Your key from the Fernbrook dashboard." },
      },
    },
  };
}
