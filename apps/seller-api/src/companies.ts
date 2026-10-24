// Fernbrook's dataset: invented public companies with quarterly financials,
// earnings releases and analyst estimates. Every company, ticker and number is
// made up. It is generated from a fixed seed, so every deploy serves the same
// data and tests can assert exact values.

export const SECTORS = [
  { slug: "software", name: "Software", grossMargin: 0.76, opMargin: 0.18, baseRevenueM: 900, growth: 0.04 },
  { slug: "semiconductors", name: "Semiconductors", grossMargin: 0.58, opMargin: 0.24, baseRevenueM: 2100, growth: 0.05 },
  { slug: "retail", name: "Retail", grossMargin: 0.34, opMargin: 0.06, baseRevenueM: 4800, growth: 0.012 },
  { slug: "energy", name: "Energy", grossMargin: 0.29, opMargin: 0.13, baseRevenueM: 6200, growth: 0.006 },
  { slug: "healthcare", name: "Healthcare", grossMargin: 0.62, opMargin: 0.15, baseRevenueM: 1700, growth: 0.022 },
  { slug: "industrials", name: "Industrials", grossMargin: 0.31, opMargin: 0.11, baseRevenueM: 3300, growth: 0.015 },
] as const;

export type SectorSlug = (typeof SECTORS)[number]["slug"];

type CompanySeed = { ticker: string; name: string; sector: SectorSlug; industry: string; city: string; what: string };

const SEEDS: readonly CompanySeed[] = [
  { ticker: "QLMR", name: "Quillmere Software", sector: "software", industry: "Application software", city: "Austin, TX", what: "accounting software for mid-sized firms" },
  { ticker: "VNTX", name: "Ventrix Cloud", sector: "software", industry: "Infrastructure software", city: "Seattle, WA", what: "managed databases and developer tools" },
  { ticker: "HLYO", name: "Halyon Security", sector: "software", industry: "Security software", city: "Boston, MA", what: "identity and access security for enterprises" },
  { ticker: "BRKW", name: "Brackenwell Analytics", sector: "software", industry: "Application software", city: "Denver, CO", what: "forecasting and planning software for retailers" },
  { ticker: "SLCN", name: "Silicorn Devices", sector: "semiconductors", industry: "Processors", city: "San Jose, CA", what: "low-power processors for phones and laptops" },
  { ticker: "PHTQ", name: "Photiq Semiconductor", sector: "semiconductors", industry: "Optical chips", city: "Tucson, AZ", what: "optical networking chips for data centres" },
  { ticker: "MRDN", name: "Meridane Memory", sector: "semiconductors", industry: "Memory", city: "Boise, ID", what: "memory chips for servers" },
  { ticker: "GTWV", name: "Gatewave Analog", sector: "semiconductors", industry: "Analog chips", city: "Dallas, TX", what: "power-management and sensor chips for cars" },
  { ticker: "OKHL", name: "Oakhollow Stores", sector: "retail", industry: "General merchandise", city: "Columbus, OH", what: "about 600 discount general stores" },
  { ticker: "FRNL", name: "Fernlea Outdoors", sector: "retail", industry: "Specialty retail", city: "Portland, OR", what: "outdoor clothing and camping gear" },
  { ticker: "PNTY", name: "Pantry & Co", sector: "retail", industry: "Grocery", city: "Atlanta, GA", what: "neighbourhood grocery stores in the Southeast" },
  { ticker: "LMRK", name: "Lumark Home", sector: "retail", industry: "Home furnishings", city: "Charlotte, NC", what: "furniture sold online and in showrooms" },
  { ticker: "CRSG", name: "Corsage Energy", sector: "energy", industry: "Oil and gas production", city: "Houston, TX", what: "oil and gas wells in the Permian Basin" },
  { ticker: "SLRW", name: "Solwright Power", sector: "energy", industry: "Renewable power", city: "Phoenix, AZ", what: "utility-scale solar farms and batteries" },
  { ticker: "TDLN", name: "Tideline Midstream", sector: "energy", industry: "Pipelines", city: "Tulsa, OK", what: "natural gas pipelines and storage" },
  { ticker: "BRVA", name: "Boreva Refining", sector: "energy", industry: "Refining", city: "Baton Rouge, LA", what: "fuel refineries on the Gulf Coast" },
  { ticker: "CLVX", name: "Clevix Therapeutics", sector: "healthcare", industry: "Biotechnology", city: "Cambridge, MA", what: "medicines for rare blood disorders" },
  { ticker: "MDHV", name: "Medhaven Health", sector: "healthcare", industry: "Health services", city: "Nashville, TN", what: "outpatient surgery centres" },
  { ticker: "ORTN", name: "Ortana Medical", sector: "healthcare", industry: "Medical devices", city: "Minneapolis, MN", what: "orthopaedic implants and surgical robots" },
  { ticker: "PLSD", name: "Pulsed Diagnostics", sector: "healthcare", industry: "Diagnostics", city: "San Diego, CA", what: "blood tests and lab instruments" },
  { ticker: "HRGT", name: "Harrowgate Industries", sector: "industrials", industry: "Machinery", city: "Milwaukee, WI", what: "farm and construction machinery" },
  { ticker: "AVLR", name: "Avalier Aerospace", sector: "industrials", industry: "Aerospace", city: "Wichita, KS", what: "aircraft parts and engine repair" },
  { ticker: "KNDL", name: "Kindle Rail Logistics", sector: "industrials", industry: "Freight and logistics", city: "Omaha, NE", what: "rail freight and warehousing" },
  { ticker: "STNV", name: "Stonevale Building", sector: "industrials", industry: "Building products", city: "Chicago, IL", what: "roofing, insulation and windows" },
];

export type Quarter = {
  fiscalPeriod: string; // "2026-Q2"
  periodEnd: string;
  reportedAt: string;
  revenue: number; // USD
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  epsDiluted: number;
  epsConsensus: number;
  revenueConsensus: number;
};

export type Estimate = {
  fiscalPeriod: string;
  reportDate: string;
  eps: { consensus: number; high: number; low: number; count: number };
  revenue: { consensus: number; high: number; low: number; count: number };
};

export type Company = {
  ticker: string;
  name: string;
  sector: SectorSlug;
  industry: string;
  exchange: "NYSE" | "NASDAQ";
  headquarters: string;
  description: string;
  employees: number;
  sharesOutstanding: number;
  price: number;
  quarters: Quarter[]; // oldest first
  estimates: Estimate[];
};

// Mulberry32: a small, well-known deterministic PRNG.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The day the data describes. Estimates and the calendar are relative to it.
export const AS_OF = "2026-10-24";

const QUARTER_END = ["03-31", "06-30", "09-30", "12-31"];
// Reported quarters run 2023-Q1 to 2026-Q2; the next two are estimated.
const FIRST_YEAR = 2023;
const REPORTED = 14;

function periodName(index: number): { year: number; q: number; name: string } {
  const year = FIRST_YEAR + Math.floor(index / 4);
  const q = (index % 4) + 1;
  return { year, q, name: `${year}-Q${q}` };
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

function buildCompany(seed: CompanySeed, index: number): Company {
  const random = seeded(1_000 + index * 7_919);
  const between = (lo: number, hi: number) => lo + random() * (hi - lo);
  const sector = SECTORS.find((s) => s.slug === seed.sector) ?? SECTORS[0];
  const scale = between(0.4, 1.8);
  const growth = sector.growth + between(-0.02, 0.025);
  const grossMargin = sector.grossMargin + between(-0.05, 0.05);
  const opMargin = sector.opMargin + between(-0.06, 0.05);
  const shares = Math.round(between(80, 900)) * 1_000_000;
  const reportLag = Math.round(between(22, 40));

  const quarters: Quarter[] = [];
  let revenue = sector.baseRevenueM * scale * 1_000_000;
  for (let i = 0; i < REPORTED; i++) {
    const { year, q, name } = periodName(i);
    revenue *= 1 + growth + between(-0.02, 0.02);
    const periodEnd = `${year}-${QUARTER_END[q - 1]}`;
    const gross = revenue * (grossMargin + between(-0.015, 0.015));
    const operating = revenue * (opMargin + between(-0.02, 0.02));
    const net = operating * between(0.72, 0.8);
    const eps = round(net / shares, 2);
    const epsSurprise = between(-0.08, 0.12);
    const revSurprise = between(-0.025, 0.035);
    quarters.push({
      fiscalPeriod: name,
      periodEnd,
      reportedAt: addDays(periodEnd, reportLag + Math.round(between(-3, 3))),
      revenue: Math.round(revenue),
      grossProfit: Math.round(gross),
      operatingIncome: Math.round(operating),
      netIncome: Math.round(net),
      epsDiluted: eps,
      epsConsensus: round(eps / (1 + epsSurprise), 2),
      revenueConsensus: Math.round(revenue / (1 + revSurprise)),
    });
  }

  const last = quarters[quarters.length - 1];
  const lastRevenue = last?.revenue ?? 0;
  const lastEps = last?.epsDiluted ?? 0;
  const estimates: Estimate[] = [];
  for (let k = 1; k <= 2; k++) {
    const { year, q, name } = periodName(REPORTED - 1 + k);
    const periodEnd = `${year}-${QUARTER_END[q - 1]}`;
    const revenueConsensus = Math.round(lastRevenue * (1 + growth) ** k);
    const epsConsensus = round(lastEps * (1 + growth) ** k, 2);
    const count = Math.round(between(6, 28));
    estimates.push({
      fiscalPeriod: name,
      // The dataset is "as of" 2026-10-24: every 2026-Q3 report is still to come.
      reportDate: k === 1 ? addDays(AS_OF, Math.round(between(3, 20))) : addDays(periodEnd, reportLag + Math.round(between(-3, 6))),
      eps: {
        consensus: epsConsensus,
        high: round(epsConsensus * between(1.04, 1.15), 2),
        low: round(epsConsensus * between(0.85, 0.96), 2),
        count,
      },
      revenue: {
        consensus: revenueConsensus,
        high: Math.round(revenueConsensus * between(1.01, 1.05)),
        low: Math.round(revenueConsensus * between(0.95, 0.99)),
        count,
      },
    });
  }

  return {
    ticker: seed.ticker,
    name: seed.name,
    sector: seed.sector,
    industry: seed.industry,
    exchange: random() < 0.5 ? "NYSE" : "NASDAQ",
    headquarters: seed.city,
    description: `${seed.name} makes ${seed.what}.`,
    employees: Math.round((lastRevenue * 4) / between(180_000, 520_000) / 10) * 10,
    sharesOutstanding: shares,
    price: round(((lastEps * 4) > 0 ? lastEps * 4 : 1) * between(12, 38), 2),
    quarters,
    estimates,
  };
}

export const COMPANIES: readonly Company[] = SEEDS.map(buildCompany);
