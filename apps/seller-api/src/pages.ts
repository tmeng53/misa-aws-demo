import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { AS_OF, COMPANIES, SECTORS } from "./companies.js";
import { PLANS, type Plan } from "./plans.js";

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

const styles = `
:root{--ink:#14213d;--muted:#56607a;--line:#dde2ec;--bg:#f6f8fb;--card:#fff;--accent:#1f6f78;--accent-ink:#fff;--warn:#b23a2a;--soft:#e8f2f3}
@media (prefers-color-scheme: dark){:root{--ink:#e6eaf2;--muted:#9aa4b8;--line:#2c3448;--bg:#0f1420;--card:#161d2c;--accent:#5fb7c0;--accent-ink:#0b1018;--warn:#ef8a78;--soft:#17303a}}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--accent)}header,main,footer{max-width:1080px;margin:0 auto;padding:0 20px}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:18px;padding-bottom:18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.brand{font-weight:800;font-size:20px;text-decoration:none;color:var(--ink);letter-spacing:-.2px}.brand span{color:var(--accent)}
nav{display:flex;gap:18px;flex-wrap:wrap;font-size:15px}nav a{text-decoration:none;color:var(--muted)}nav a:hover{color:var(--ink)}
h1{font-size:40px;line-height:1.12;margin:48px 0 12px;letter-spacing:-.6px}h2{margin-top:44px}.lede{font-size:19px;color:var(--muted);max-width:700px}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);padding:10px 18px;border-radius:8px;text-decoration:none;border:0;font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.btn.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:24px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px}
.card.featured{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.price{font-size:34px;font-weight:800}.price small{font-size:15px;color:var(--muted);font-weight:400}
ul.ticks{padding-left:18px;color:var(--muted)}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px}pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px;overflow-x:auto}
form{display:grid;gap:12px;max-width:460px}label{display:grid;gap:4px;font-size:14px;color:var(--muted)}
input,select{font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
.table{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:15px}td,th{text-align:left;padding:8px;border-bottom:1px solid var(--line)}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.note{font-size:14px;color:var(--muted)}.warn{color:var(--warn)}
.toggle{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px;background:var(--card)}.toggle button{border:0;background:transparent;color:var(--muted);padding:6px 14px;border-radius:999px;font:inherit;cursor:pointer}.toggle button[aria-pressed=true]{background:var(--soft);color:var(--ink);font-weight:600}
.tag{display:inline-block;background:var(--soft);border-radius:6px;padding:1px 8px;font-size:13px}
footer{margin-top:64px;padding-top:20px;padding-bottom:40px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
`;

function layout(title: string, body: Html, head: Html = html``): Html {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      ${raw(styles)}
    </style>
    ${head}
  </head>
  <body>
    <header>
      <a class="brand" href="/">Fern<span>brook</span></a>
      <nav>
        <a href="/companies">Coverage</a>
        <a href="/pricing">Pricing</a>
        <a href="/docs">API docs</a>
        <a href="/signup">Get an API key</a>
      </nav>
    </header>
    <main>${body}</main>
    <footer>
      Fernbrook is a fictional data company made for a demo. Every company, ticker and figure on this site is invented. Data as of ${AS_OF}.
    </footer>
  </body>
</html>`;
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const billions = (n: number) => `$${(n / 1e9).toFixed(1)}B`;

function planCard(plan: Plan): Html {
  const featured = plan.id === "professional";
  return html`<div class="card ${featured ? "featured" : ""}">
    <h3>${plan.name} ${featured ? html`<span class="tag">Most popular</span>` : ""}</h3>
    <div class="price">
      <span data-monthly>${usd(plan.monthlyUsd)}<small> / month</small></span>
      <span data-annual hidden>${usd(plan.annualUsd)}<small> / year</small></span>
    </div>
    <p class="note">${plan.requestsPerMonth.toLocaleString("en-US")} API calls a month</p>
    <p>${plan.blurb}</p>
    <ul class="ticks">
      ${plan.features.map((f) => html`<li>${f}</li>`)}
    </ul>
    <a class="btn ${featured ? "" : "ghost"}" href="/signup?plan=${plan.id}">Choose ${plan.name}</a>
  </div>`;
}

export function homePage(): Html {
  return layout(
    "Fernbrook · Company fundamentals API",
    html`<h1>Fundamentals and earnings estimates, one API key away.</h1>
      <p class="lede">
        Clean financials, consensus estimates and earnings surprises for ${COMPANIES.length} US-listed companies across ${SECTORS.length} sectors.
        Pick a plan, get a key, pull data into your model or spreadsheet.
      </p>
      <p><a class="btn" href="/signup?plan=professional">Start your plan</a> <a class="btn ghost" href="/pricing">See pricing</a></p>
      <div class="grid">
        <div class="card"><strong>Financials</strong><p class="note">Quarterly and annual income statements back to 2023.</p></div>
        <div class="card"><strong>Consensus estimates</strong><p class="note">EPS and revenue expectations for the next two quarters.</p></div>
        <div class="card"><strong>Earnings history</strong><p class="note">Every reported quarter against the consensus, with the surprise.</p></div>
        <div class="card"><strong>Sector comparisons</strong><p class="note">Rank peers on growth, margins and size.</p></div>
      </div>`,
  );
}

export function coveragePage(): Html {
  return layout(
    "Coverage · Fernbrook",
    html`<h1>Coverage</h1>
      <p class="lede">${COMPANIES.length} companies across ${SECTORS.length} sectors. Data as of ${AS_OF}.</p>
      <div class="table">
        <table>
          <tr><th>Ticker</th><th>Company</th><th>Sector</th><th>Industry</th><th class="n">Market cap</th></tr>
          ${COMPANIES.map(
            (c) =>
              html`<tr>
                <td><strong>${c.ticker}</strong></td>
                <td>${c.name}</td>
                <td>${SECTORS.find((s) => s.slug === c.sector)?.name ?? c.sector}</td>
                <td>${c.industry}</td>
                <td class="n">${billions(c.price * c.sharesOutstanding)}</td>
              </tr>`,
          )}
        </table>
      </div>`,
  );
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
  // JSON.stringify output is safe inside a script tag once "<" is escaped.
  const jsonLd = JSON.stringify(pricingJsonLd(baseUrl)).replace(/</g, "\\u003c");
  return layout(
    "Pricing · Fernbrook",
    html`<h1>Plans for every desk.</h1>
      <p class="lede">Pay monthly, or yearly and get two months free. Calls reset on the first of each month.</p>
      <div class="toggle" role="group" aria-label="Billing">
        <button type="button" data-billing="monthly" aria-pressed="true">Monthly</button>
        <button type="button" data-billing="annual" aria-pressed="false">Yearly</button>
      </div>
      <div class="grid">${PLANS.map(planCard)}</div>
      <p>Need bulk files or redistribution rights? <a href="mailto:sales@fernbrook.example">Talk to sales</a>.</p>
      <p class="note">Prices in US dollars, billed by card. Unused calls don't roll over. Need more calls? Upgrade any time.</p>
      <script>
        document.querySelectorAll("[data-billing]").forEach((button) => {
          button.addEventListener("click", () => {
            const annual = button.dataset.billing === "annual";
            document.querySelectorAll("[data-billing]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
            document.querySelectorAll("[data-monthly]").forEach((el) => (el.hidden = annual));
            document.querySelectorAll("[data-annual]").forEach((el) => (el.hidden = !annual));
          });
        });
      </script>`,
    html`<script type="application/ld+json">
      ${raw(jsonLd)}
    </script>`,
  );
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
  return layout(
    "API docs · Fernbrook",
    html`<h1>API docs</h1>
      <p class="lede">Send your key in the <code>X-API-Key</code> header. Every answer is JSON. Money is in US dollars; ratios are fractions.</p>
      <pre>curl "${baseUrl}/v1/companies/QLMR/estimates" \\
  -H "X-API-Key: fb_live_..."</pre>
      <div class="table">
        <table>
          <tr><th>Call</th><th>What it does</th></tr>
          ${rows.map(([call, what]) => html`<tr><td><code>${call}</code></td><td>${what}</td></tr>`)}
        </table>
      </div>
      <p>Sectors: ${SECTORS.map((s) => s.slug).join(", ")}. The full description is at <a href="/openapi.json">/openapi.json</a> (OpenAPI 3.0).</p>
      <h2>Errors</h2>
      <p>Errors use RFC 9457 problem details. <code>401</code> means a missing or wrong key; <code>429</code> means this month's calls are used up.</p>`,
  );
}

export function signupPage(selected: string): Html {
  return layout(
    "Get an API key · Fernbrook",
    html`<h1>Get your API key</h1>
      <p class="lede">It takes a minute. This is a demo, so no card is charged.</p>
      <form method="post" action="/signup">
        <label>Work email <input type="email" name="email" required autocomplete="email" /></label>
        <label
          >Plan
          <select name="plan">
            ${PLANS.map(
              (p) =>
                html`<option value="${p.id}" ${p.id === selected ? "selected" : ""}>
                  ${p.name}: ${usd(p.monthlyUsd)}/month, ${p.requestsPerMonth.toLocaleString("en-US")} calls
                </option>`,
            )}
          </select>
        </label>
        <button class="btn" type="submit">Create my key</button>
      </form>`,
  );
}

export function keyPage(input: { email: string; plan: Plan; key: string; baseUrl: string }): Html {
  return layout(
    "Your API key · Fernbrook",
    html`<h1>Welcome to ${input.plan.name}.</h1>
      <p class="lede">Here is the key for ${input.email}. Keep it secret: anyone with it can use your calls.</p>
      <pre>${input.key}</pre>
      <p>
        Your plan includes ${input.plan.requestsPerMonth.toLocaleString("en-US")} calls a month for ${usd(input.plan.monthlyUsd)}. Try it:
      </p>
      <pre>curl "${input.baseUrl}/v1/calendar" -H "X-API-Key: ${input.key}"</pre>`,
  );
}
