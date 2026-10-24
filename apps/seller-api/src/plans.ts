import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Fernbrook sells the way most data APIs do today: a person picks a monthly or
// annual plan, gets an API key, and pays whether they use it or not.

export const PLANS = [
  {
    id: "free",
    name: "Free",
    monthlyUsd: 0,
    annualUsd: 0,
    requestsPerMonth: 100,
    blurb: "Try the data before you commit.",
    features: ["Company search and profiles", "Quarterly financials", "Community support"],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyUsd: 29,
    annualUsd: 290,
    requestsPerMonth: 2_000,
    blurb: "For an individual investor or analyst.",
    features: ["Everything in Free", "Consensus estimates", "Earnings history and calendar", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyUsd: 99,
    annualUsd: 990,
    requestsPerMonth: 10_000,
    blurb: "For a research team that models every day.",
    features: ["Everything in Starter", "Sector comparisons", "5 seats", "Priority support"],
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
  const match = /^fb_live_(free|starter|pro)_([A-Za-z0-9]{12})_([A-Za-z0-9_-]{22})$/.exec(key);
  if (!match) return undefined;
  const [, plan, keyId, signature] = match;
  if (!plan || !keyId || !signature || !isPlanId(plan)) return undefined;
  const expected = Buffer.from(sign(secret, `${plan}_${keyId}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  return { plan, keyId };
}
