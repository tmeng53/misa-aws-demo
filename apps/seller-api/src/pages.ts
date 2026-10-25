import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { AS_OF, COMPANIES, SECTORS, type Company } from "./companies.js";
import { getEarnings, getEstimates } from "./fundamentals.js";
import { PLANS, type Plan } from "./plans.js";

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;
type PageName = "home" | "coverage" | "pricing" | "excel" | "about" | "subscribe";

const styles = `
:root {
  --ink: #1c1915;
  --muted: #5c564c;
  --navy: #1c3048;
  --navy-2: #152536;
  --paper: #f4f0e6;
  --sheet: #fffdf8;
  --rule: #d4cdb8;
  --rule-strong: #1c3048;
  --burgundy: #6e2c2c;
  --link: #1c3048;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: #e7e1d4;
  color: var(--ink);
  font: 15px/1.45 Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif;
}
a { color: var(--link); }
.wrap { max-width: 980px; margin: 18px auto 40px; background: var(--paper); border: 1px solid #c9c1ae; }
.util {
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  background: var(--navy-2); color: #efe8d8; font: 12px/1 Arial, Helvetica, sans-serif;
  padding: 7px 18px; letter-spacing: .02em;
}
.util a { color: #efe8d8; }
.mast {
  display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  padding: 16px 18px 12px; border-bottom: 4px solid var(--navy);
}
.word { font-size: 34px; letter-spacing: .14em; font-weight: normal; margin: 0; line-height: 1; }
.since { margin: 4px 0 0; font: 12px/1.3 Arial, Helvetica, sans-serif; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
.mast-side { text-align: right; font: 12px/1.4 Arial, Helvetica, sans-serif; color: var(--muted); }
nav { background: var(--navy); display: flex; flex-wrap: wrap; gap: 0; }
nav a {
  color: #f4f0e6; text-decoration: none; border-right: 1px solid #34506e;
  font: 13px/1 Arial, Helvetica, sans-serif; letter-spacing: .04em; padding: 10px 14px;
}
nav a[aria-current="page"] { background: #f4f0e6; color: var(--navy); font-weight: bold; }
main { padding: 18px 18px 8px; }
h1 { font-size: 26px; font-weight: normal; margin: 0 0 8px; }
h1.word { font-size: 34px; letter-spacing: .14em; margin: 0; }
h2 { font-size: 18px; font-weight: normal; margin: 22px 0 8px; border-bottom: 1px solid var(--rule-strong); padding-bottom: 3px; }
p { margin: 0 0 10px; }
.doors { display: grid; grid-template-columns: 1fr 1fr 1fr; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); margin: 12px 0 18px; }
.door { padding: 10px 12px 12px; border-right: 1px solid var(--rule); }
.door:last-child { border-right: 0; }
.kicker { font: 11px/1 Arial, Helvetica, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: var(--burgundy); margin: 0 0 4px; }
.door p { font-size: 14px; margin: 0; }
.table { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font: 13px/1.35 Arial, Helvetica, sans-serif; }
th { text-align: left; font-weight: bold; background: var(--navy); color: #f4f0e6; padding: 6px 8px; }
td { padding: 5px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
tr:nth-child(even) td { background: #efeae0; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
.sheet {
  display: grid; grid-template-columns: 1.3fr .7fr; gap: 0;
  background: var(--sheet); border: 1px solid var(--navy); margin-top: 8px;
}
.sheet-main, .sheet-side { padding: 12px 14px; }
.sheet-side { border-left: 1px solid var(--rule); background: #f7f3ea; }
.sheet h3 { margin: 0; font-size: 20px; font-weight: normal; }
.ticker { font: 12px/1 Arial, Helvetica, sans-serif; letter-spacing: .08em; color: var(--muted); }
.stats { width: 100%; font: 13px/1.4 Arial, Helvetica, sans-serif; border-collapse: collapse; }
.stats td, .stats tr:nth-child(even) td { border: 0; background: transparent; padding: 2px 0; }
.stats td.n { text-align: right; }
.btn {
  display: inline-block; background: var(--burgundy); color: #fffdf8; text-decoration: none;
  font: bold 13px/1 Arial, Helvetica, sans-serif; padding: 8px 12px; border: 0; cursor: pointer;
}
form { display: grid; gap: 8px; max-width: 420px; font: 14px Arial, Helvetica, sans-serif; }
label { display: grid; gap: 3px; }
input, select { font: 14px Arial, Helvetica, sans-serif; padding: 6px 8px; border: 1px solid #b7ad98; background: white; }
pre, code { font: 13px/1.45 ui-monospace, "Courier New", monospace; }
pre { background: var(--sheet); border: 1px solid var(--rule); padding: 10px 12px; overflow-x: auto; }
.actions { margin-top: 14px; }
footer {
  margin-top: 22px; padding: 12px 18px 16px; border-top: 4px solid var(--navy);
  font: 12px/1.45 Arial, Helvetica, sans-serif; color: var(--muted);
}
footer a { color: var(--muted); }
.note { font: 12px/1.4 Arial, Helvetica, sans-serif; color: var(--muted); }
@media (max-width: 720px) {
  .doors, .sheet { grid-template-columns: 1fr; }
  .door { border-right: 0; border-bottom: 1px solid var(--rule); }
  .sheet-side { border-left: 0; border-top: 1px solid var(--rule); }
  .word, h1.word { font-size: 26px; letter-spacing: .08em; }
  .mast-side { text-align: left; }
}
`;

const NAV: readonly { id: PageName; href: string; label: string }[] = [
  { id: "home", href: "/", label: "Home" },
  { id: "coverage", href: "/companies", label: "Coverage" },
  { id: "pricing", href: "/pricing", label: "Pricing" },
  { id: "excel", href: "/docs", label: "Excel & API" },
  { id: "about", href: "/about", label: "About" },
  { id: "subscribe", href: "/signup", label: "Subscribe" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const epsText = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One public pay-per-call for the QLMR consensus. No account, key, or address belongs in this note.
const QLMR_PAID_CALL_URL = "https://api.trymisa.com/x/fernbrook-fundamentals/v1/companies/QLMR/estimates";
const QLMR_PAID_PRICE = "$0.50";

function moneyWords(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)} billion`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)} million`;
  return usd(n);
}

function qlmrEstimateNote(): { prose: string } | undefined {
  const company = COMPANIES.find((c) => c.ticker === "QLMR");
  const estimates = company ? getEstimates(company.ticker) : undefined;
  const quarters = estimates?.results ?? [];
  const first = quarters[0];
  const second = quarters[1];
  if (!company || !first || !second) return undefined;
  const quarter = (row: typeof first) => {
    const year = isoToUtc(row.report_date).getUTCFullYear();
    return `For ${row.fiscal_period}, reporting ${formatDay(row.report_date)} ${year}, the consensus is ${epsText(row.eps_consensus)} of earnings per share, between ${epsText(row.eps_low)} and ${epsText(row.eps_high)}, and ${moneyWords(row.revenue_consensus)} of revenue, between ${moneyWords(row.revenue_low)} and ${moneyWords(row.revenue_high)}. ${row.analyst_count} analysts contributed.`;
  };
  return {
    prose: `${company.name}, ticker ${company.ticker}, is a fictional company. Fernbrook invented the company, the ticker, and these figures. ${quarter(first)} ${quarter(second)}`,
  };
}

function sectorName(slug: Company["sector"]): string {
  return SECTORS.find((s) => s.slug === slug)?.name ?? slug;
}

function isoToUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addIsoDays(iso: string, days: number): string {
  const date = isoToUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDay(iso: string): string {
  const date = isoToUtc(iso);
  const weekday = WEEKDAYS[date.getUTCDay()] ?? "";
  const month = MONTHS[date.getUTCMonth()] ?? "";
  return `${weekday} ${date.getUTCDate()} ${month}`;
}

function formatAsOf(iso: string): string {
  const date = isoToUtc(iso);
  const month = MONTHS[date.getUTCMonth()] ?? "";
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

// AS_OF is a Saturday in this dataset. "This week" is the Monday–Sunday week
// that starts on or after that date, using each company's next reportDate.
// It is not a separate calendar.
function reportingWeek(asOf: string): { from: string; to: string } {
  const day = isoToUtc(asOf).getUTCDay();
  const untilMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  const from = addIsoDays(asOf, untilMonday);
  return { from, to: addIsoDays(from, 6) };
}

type ReportRow = { date: string; ticker: string; name: string; sector: string; eps: number; count: number };

function reportRows(from: string, to: string): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const company of COMPANIES) {
    for (const estimate of company.estimates) {
      if (estimate.reportDate < from || estimate.reportDate > to) continue;
      rows.push({
        date: estimate.reportDate,
        ticker: company.ticker,
        name: company.name,
        sector: sectorName(company.sector),
        eps: estimate.eps.consensus,
        count: estimate.eps.count,
      });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
  return rows;
}

function homeReports(): { heading: string; note: string; rows: ReportRow[] } {
  const week = reportingWeek(AS_OF);
  const rows = reportRows(week.from, week.to);
  if (rows.length > 0) {
    return {
      heading: "Reports this week",
      note: "Week of 26 October 2026.",
      rows,
    };
  }
  const upcoming = reportRows(AS_OF, "9999-12-31");
  const first = upcoming[0];
  if (!first) {
    return {
      heading: "Reports this week",
      note: `No upcoming report dates are on file as of ${formatAsOf(AS_OF)}.`,
      rows: [],
    };
  }
  const to = addIsoDays(first.date, 6);
  return {
    heading: "Next reports",
    note: `No company reports in the week of ${formatDay(week.from)}. The next dates on file run ${formatDay(first.date)} through ${formatDay(to)}. Figures are sample data.`,
    rows: reportRows(first.date, to),
  };
}

function layout(input: { title: string; page: PageName; body: Html; head?: Html }): Html {
  const head = input.head ?? html``;
  const founded = 2004;
  const year = isoToUtc(AS_OF).getUTCFullYear();
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <style>
      ${raw(styles)}
    </style>
    ${head}
  </head>
  <body>
    <div class="wrap">
      <div class="util">
        <span>Hartford, Connecticut · Consensus estimates since ${founded}</span>
        <span><a href="mailto:sales@fernbrook.example">sales@fernbrook.example</a> · <a href="/signup">Subscribe</a></span>
      </div>
      <header class="mast">
        <div>
          <h1 class="word">FERNBROOK</h1>
          <p class="since">Estimates</p>
        </div>
        <div class="mast-side">
          ${COMPANIES.length} companies · ${SECTORS.length} sectors<br />
          Data as of ${formatAsOf(AS_OF)}
        </div>
      </header>
      <nav>
        ${NAV.map((item) =>
          item.id === input.page
            ? html`<a href="${item.href}" aria-current="page">${item.label}</a>`
            : html`<a href="${item.href}">${item.label}</a>`,
        )}
      </nav>
      <main>${input.body}</main>
      <footer>
        Fernbrook Estimates · Hartford, Connecticut · © ${founded}–${year} ·
        <a href="mailto:sales@fernbrook.example">sales@fernbrook.example</a> ·
        <a href="/llms.txt">llms.txt</a><br />
        Figures on this site are sample data. Fictional companies only.
      </footer>
    </div>
  </body>
</html>`;
}

function planAudience(plan: Plan): string {
  switch (plan.id) {
    case "individual":
      return "An investor following a handful of names";
    case "professional":
      return "An analyst who models every week";
    case "enterprise":
      return "A research desk or a university department";
  }
}

function planIncluded(plan: Plan): string {
  const calls = `${plan.requestsPerMonth.toLocaleString("en-US")} calls a month`;
  switch (plan.id) {
    case "individual":
      return `Sheets, financials, earnings calendar. ${calls}.`;
    case "professional":
      return `Estimates, surprises, sector ranks, and a key for Excel. ${calls}.`;
    case "enterprise":
      return `10 seats, one shared key, yearly invoice. ${calls}.`;
  }
}

function surpriseText(pct: number): string {
  const text = pct.toFixed(1);
  return pct > 0 ? `+${text}%` : `${text}%`;
}

export function homePage(): Html {
  const reports = homeReports();
  const company = COMPANIES.find((c) => c.ticker === "QLMR") ?? COMPANIES[0];
  const next = company ? getEstimates(company.ticker)?.results[0] : undefined;
  const last = company ? getEarnings(company.ticker, 1)?.results[0] : undefined;
  return layout({
    title: "Fernbrook Estimates",
    page: "home",
    body: html`<div class="doors">
        <div class="door">
          <p class="kicker">For individuals</p>
          <p>The consensus sheet for names you already follow. Web access, financials, and the earnings calendar.</p>
        </div>
        <div class="door">
          <p class="kicker">For professionals</p>
          <p>Estimates, surprises, and peer ranks for an analyst who models every week. Includes a key for Excel.</p>
        </div>
        <div class="door">
          <p class="kicker">For a department</p>
          <p>Ten seats for a research desk or a university class. One shared key. We invoice the department yearly.</p>
        </div>
      </div>
      <h2>${reports.heading}</h2>
      <div class="table">
        <table>
          <tr>
            <th>Date</th>
            <th>Ticker</th>
            <th>Company</th>
            <th>Sector</th>
            <th class="n">Consensus EPS</th>
            <th class="n">Estimates</th>
          </tr>
          ${reports.rows.map(
            (row) => html`<tr>
              <td>${formatDay(row.date)}</td>
              <td>${row.ticker}</td>
              <td>${row.name}</td>
              <td>${row.sector}</td>
              <td class="n">${epsText(row.eps)}</td>
              <td class="n">${row.count}</td>
            </tr>`,
          )}
        </table>
      </div>
      <p class="note">${reports.note}</p>
      ${
        company && next
          ? html`<h2>Sample sheet · ${company.name}</h2>
            <div class="sheet">
              <div class="sheet-main">
                <p class="ticker">${company.exchange} · ${company.ticker} · ${sectorName(company.sector).toUpperCase()}</p>
                <h3>${company.name}</h3>
                <p>${company.description} ${company.headquarters}. Consensus for ${next.fiscal_period}.</p>
                <table class="stats">
                  <tr>
                    <td>Consensus EPS</td>
                    <td class="n">${epsText(next.eps_consensus)}</td>
                  </tr>
                  <tr>
                    <td>High / low</td>
                    <td class="n">${epsText(next.eps_high)} / ${epsText(next.eps_low)}</td>
                  </tr>
                  <tr>
                    <td>Number of estimates</td>
                    <td class="n">${next.analyst_count}</td>
                  </tr>
                  <tr>
                    <td>Consensus revenue</td>
                    <td class="n">${usd(next.revenue_consensus)}</td>
                  </tr>
                  <tr>
                    <td>Next report</td>
                    <td class="n">${formatDay(next.report_date)} ${isoToUtc(next.report_date).getUTCFullYear()}</td>
                  </tr>
                  ${
                    last
                      ? html`<tr>
                          <td>Last quarter surprise</td>
                          <td class="n">${surpriseText(last.eps_surprise_pct)}</td>
                        </tr>
                        <tr>
                          <td>Reported vs consensus EPS</td>
                          <td class="n">${epsText(last.eps_actual)} vs ${epsText(last.eps_consensus)}</td>
                        </tr>`
                      : ""
                  }
                </table>
              </div>
              <div class="sheet-side">
                <p class="kicker">On this page</p>
                <p>One company. One quarter. The number our clients put in the model.</p>
                <p><a class="btn" href="/pricing">See subscriptions</a></p>
                <p class="note" style="margin-top:10px">
                  Full coverage is ${COMPANIES.length} companies. We do not follow the rest of the market.
                </p>
              </div>
            </div>`
          : ""
      }
      ${qlmrDiscoverySection()}`,
  });
}

function qlmrDiscoverySection(): Html {
  const note = qlmrEstimateNote();
  if (!note) return html``;
  return html`<h2 id="consensus-estimates-for-qlmr">Consensus estimates for QLMR</h2>
    <p>${note.prose}</p>
    <p>One paid call for these consensus estimates costs ${QLMR_PAID_PRICE}. The paid call URL is <a href="${QLMR_PAID_CALL_URL}">${QLMR_PAID_CALL_URL}</a>.</p>
    <p>The same note, for a person or an agent, is linked from <a href="/llms.txt">llms.txt</a>.</p>`;
}

export function llmsTxt(baseUrl: string): string {
  const note = qlmrEstimateNote();
  const prose = note?.prose ?? "Quillmere Software, ticker QLMR, is a fictional company. Fernbrook invented it.";
  const origin = baseUrl.replace(/\/$/, "");
  return `# Fernbrook Estimates

Fernbrook Estimates is a fictional research shop in Hartford. Every company, ticker, and figure is made up.

## Consensus estimates for QLMR

${prose}

One paid call costs ${QLMR_PAID_PRICE}.
Paid call: ${QLMR_PAID_CALL_URL}

Read the same section on the site: ${origin}/#consensus-estimates-for-qlmr
`;
}

export function coveragePage(): Html {
  return layout({
    title: "Coverage · Fernbrook Estimates",
    page: "coverage",
    body: html`<h1>Coverage</h1>
      <p>${COMPANIES.length} companies, chosen because our clients hold them. ${SECTORS.length} sectors. Data as of ${formatAsOf(AS_OF)}.</p>
      <div class="table">
        <table>
          <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Sector</th>
            <th>Industry</th>
            <th>Headquarters</th>
          </tr>
          ${COMPANIES.map(
            (c) => html`<tr>
              <td>${c.ticker}</td>
              <td>${c.name}</td>
              <td>${sectorName(c.sector)}</td>
              <td>${c.industry}</td>
              <td>${c.headquarters}</td>
            </tr>`,
          )}
        </table>
      </div>`,
  });
}

// schema.org JSON-LD for the plans, so software can read prices without
// scraping the page. Monthly offers bill every month (P1M); annual ones every
// year (P1Y). Both state the calls included per month.
export function pricingJsonLd(baseUrl: string) {
  const offer = (plan: Plan, billing: "P1M" | "P1Y") => {
    const quantity = { "@type": "QuantitativeValue", value: plan.requestsPerMonth, unitText: "API calls", unitCode: "MON" };
    const price = billing === "P1M" ? plan.monthlyUsd : plan.annualUsd;
    return {
      "@type": "Offer",
      name: billing === "P1M" ? plan.name : `${plan.name} (annual)`,
      url: `${baseUrl}/signup?plan=${plan.id}`,
      price: price.toFixed(2),
      priceCurrency: "USD",
      eligibleQuantity: quantity,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: "USD",
        billingDuration: billing,
        eligibleQuantity: quantity,
      },
    };
  };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Fernbrook Fundamentals API",
    description: "Monthly and annual plans for the Fernbrook company fundamentals API.",
    url: `${baseUrl}/pricing`,
    brand: { "@type": "Brand", name: "Fernbrook" },
    offers: [...PLANS.map((p) => offer(p, "P1M")), ...PLANS.map((p) => offer(p, "P1Y"))],
  };
}

export function pricingPage(baseUrl: string): Html {
  const jsonLd = JSON.stringify(pricingJsonLd(baseUrl)).replace(/</g, "\\u003c");
  return layout({
    title: "Pricing · Fernbrook Estimates",
    page: "pricing",
    body: html`<h1>Subscriptions</h1>
      <p>
        Yearly is ten months' price. Calls reset on the first of each month and do not roll over. Card for Individual and
        Professional. Invoice for Enterprise.
      </p>
      <div class="table">
        <table>
          <tr>
            <th>Plan</th>
            <th>Who it is for</th>
            <th class="n">Year</th>
            <th class="n">Month</th>
            <th>Included</th>
          </tr>
          ${PLANS.map(
            (plan) => html`<tr>
              <td>${plan.name}</td>
              <td>${planAudience(plan)}</td>
              <td class="n">${usd(plan.annualUsd)}</td>
              <td class="n">${usd(plan.monthlyUsd)}</td>
              <td>${planIncluded(plan)}</td>
            </tr>`,
          )}
        </table>
      </div>
      <p class="actions"><a class="btn" href="/signup">Subscribe</a></p>
      <p class="note">Prices in US dollars. Unused calls do not roll over.</p>`,
    head: html`<script type="application/ld+json">
      ${raw(jsonLd)}
    </script>`,
  });
}

export function docsPage(baseUrl: string): Html {
  const rows: [string, string][] = [
    ["GET /v1/companies?q=&sector=", "Search companies by name, ticker or industry."],
    ["GET /v1/companies/{ticker}", "Company profile, share price and next report date."],
    ["GET /v1/companies/{ticker}/financials?period=quarter|annual", "Income statement figures, newest first."],
    ["GET /v1/companies/{ticker}/estimates", "Consensus EPS and revenue for the next two quarters."],
    ["GET /v1/companies/{ticker}/earnings", "Past quarters against the consensus, with surprise %."],
    ["GET /v1/calendar?from=&to=&sector=", "Who reports earnings between two dates."],
    ["GET /v1/sectors", "Sectors covered."],
    ["GET /v1/sectors/{sector}/compare?metric=", "Rank a sector on revenue_growth_yoy, gross_margin, net_margin, eps_growth_yoy or market_cap_usd."],
  ];
  const individual = PLANS.find((plan) => plan.id === "individual");
  const calls = individual ? individual.requestsPerMonth.toLocaleString("en-US") : "";
  return layout({
    title: "Excel & API · Fernbrook Estimates",
    page: "excel",
    body: html`<h1>Excel &amp; API</h1>
      <p>
        A subscription includes a key so a person can pull a sheet into Excel or a model. Send it in the
        <code>X-API-Key</code> header.
      </p>
      <pre>curl "${baseUrl}/v1/companies/QLMR/estimates" \\
  -H "X-API-Key: fb_live_..."</pre>
      <div class="table">
        <table>
          <tr>
            <th>Call</th>
            <th>What you get</th>
          </tr>
          ${rows.map(([call, what]) => html`<tr><td><code>${call}</code></td><td>${what}</td></tr>`)}
        </table>
      </div>
      <p>Sectors: ${SECTORS.map((s) => s.slug).join(", ")}. The full description is at <a href="/openapi.json">/openapi.json</a> (OpenAPI 3.0).</p>
      <p class="note">
        Individual includes ${calls} calls a month, enough to refresh a short list. A missing or wrong key returns 401. A used-up
        month returns 429.
      </p>`,
  });
}

export function aboutPage(): Html {
  return layout({
    title: "About · Fernbrook Estimates",
    page: "about",
    body: html`<h1>About</h1>
      <p>
        Fernbrook Estimates started in Hartford in 2004. Two people left a regional bank's research desk and kept writing the
        consensus for the names their clients actually held.
      </p>
      <p>
        The list is still ${COMPANIES.length} companies. Each one has a single page: EPS and revenue, high, low, how many
        estimates, and the last surprise.
      </p>
      <p>
        In 2018 a university finance department and two investor-relations firms asked to stop retyping the sheet into Excel.
        The subscription has included a key since then. The sheet is still the product.
      </p>
      <p>
        Fernbrook Estimates<br />
        Hartford, Connecticut<br />
        <a href="mailto:sales@fernbrook.example">sales@fernbrook.example</a>
      </p>`,
  });
}

export function signupPage(selected: string): Html {
  return layout({
    title: "Subscribe · Fernbrook Estimates",
    page: "subscribe",
    body: html`<h1>Subscribe</h1>
      <p>Tell us the plan and where to send the key. No card is charged on this form.</p>
      <form method="post" action="/signup">
        <label>Name <input type="text" name="name" autocomplete="name" /></label>
        <label>Work email <input type="email" name="email" required autocomplete="email" /></label>
        <label
          >Plan
          <select name="plan">
            ${PLANS.map(
              (plan) => html`<option value="${plan.id}" ${plan.id === selected ? "selected" : ""}>
                ${plan.name} — ${usd(plan.annualUsd)} / year${plan.id === "enterprise" ? ", invoiced" : ""}
              </option>`,
            )}
          </select>
        </label>
        <label>Institution, if this is for a department <input type="text" name="institution" placeholder="University or firm" /></label>
        <button class="btn" type="submit">Subscribe</button>
      </form>`,
  });
}

export function keyPage(input: { email: string; plan: Plan; key: string; baseUrl: string }): Html {
  return layout({
    title: "Your key · Fernbrook Estimates",
    page: "subscribe",
    body: html`<h1>Your ${input.plan.name} key</h1>
      <p>Here is the key for ${input.email}. Keep it secret: anyone with it can use your calls.</p>
      <pre>${input.key}</pre>
      <p>
        This plan includes ${input.plan.requestsPerMonth.toLocaleString("en-US")} calls a month. ${usd(input.plan.annualUsd)} a year,
        or ${usd(input.plan.monthlyUsd)} a month. Pull a sheet into Excel:
      </p>
      <pre>curl "${input.baseUrl}/v1/calendar" -H "X-API-Key: ${input.key}"</pre>`,
  });
}
