import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Fernbrook sells the way most data APIs do today: a person picks a monthly or
// annual plan, gets an API key, and pays whether they use it or not.

export const PLANS = [
  {
    id: "individual",
    name: "Individual",
    monthlyUsd: 25,
    annualUsd: 250,
    requestsPerMonth: 50,
    blurb: "For an investor following a handful of names.",
    features: ["Company profiles and search", "Quarterly and annual financials", "Earnings calendar", "Email support"],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyUsd: 292,
    annualUsd: 2_920,
    requestsPerMonth: 1_000,
    blurb: "For an analyst who models every week.",
    features: ["Everything in Individual", "Consensus estimates", "Earnings history with surprises", "Sector comparisons"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyUsd: 708,
    annualUsd: 7_080,
    requestsPerMonth: 5_000,
    blurb: "For a research desk sharing one account.",
    features: ["Everything in Professional", "10 seats", "Priority support", "Annual invoicing"],
  },
] as const;

export type Plan = (typeof PLANS)[number];
export type PlanId = Plan["id"];

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function isPlanId(id: string): id is PlanId {
  return PLANS.some((p) => p.id === id);
}

// API keys carry their plan and are signed, so the API needs no database to
// check them: fb_live_<plan>_<random>_<signature>.
export type ApiKey = { plan: PlanId; keyId: string };

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url").slice(0, 22);
}

export function issueKey(secret: string, plan: PlanId): string {
  const keyId = randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
  const body = `${plan}_${keyId}`;
  return `fb_live_${body}_${sign(secret, body)}`;
}

export function readKey(secret: string, key: string): ApiKey | undefined {
  const match = /^fb_live_(individual|professional|enterprise)_([A-Za-z0-9]{12})_([A-Za-z0-9_-]{22})$/.exec(key);
  if (!match) return undefined;
  const [, plan, keyId, signature] = match;
  if (!plan || !keyId || !signature || !isPlanId(plan)) return undefined;
  const expected = Buffer.from(sign(secret, `${plan}_${keyId}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  return { plan, keyId };
}
