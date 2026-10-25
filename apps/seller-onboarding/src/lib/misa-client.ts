// The Misa service's seller onboarding API, as this app uses it (contract
// v2.1). Misa itself is a separate, private service reached over HTTPS; call it
// only from server code so the seller token never reaches the browser.

export type Plan = { name: string; price_usd_month: number; calls_per_month: number; source: "pricing_page" | "seller" };

export type Operation = {
  operation_id: string;
  method: string;
  path: string;
  summary: string;
  price_usd: string;
  price_reason: string;
  enabled: boolean;
};

export type Channels = { misa_catalog: boolean; agent_tool_hubs: boolean };

export type Draft = {
  api_id: string;
  slug: string;
  status: "draft" | "live";
  name: string;
  description: string;
  seller: { id: string; name: string; email: string };
  upstream: { base_url: string; openapi_url: string; auth: { type: "header"; name: string } };
  payout_methods: { kind: "stripe_account"; status: "not_linked" | "pending" | "linked"; accepts: string[] }[];
  payment_options: { protocol: "x402"; scheme: string; network: string; asset: string }[];
  channels: Channels;
  plans: Plan[];
  operations: Operation[];
  checks: { name: string; description: string }[];
  door_url: string | null;
  listing_url: string | null;
  openapi_url: string | null;
};

export type NewApi = {
  seller: { name: string; email: string };
  openapi_url: string;
  pricing_url?: string;
  plans?: { name: string; price_usd_month: number; calls_per_month: number }[];
  upstream_auth: { type: "header"; name: string; value: string };
};

export type DraftChanges = {
  description?: string;
  channels?: Partial<Channels>;
  operations?: { operation_id: string; price_usd?: string; enabled?: boolean }[];
};

export type Usage = {
  totals: {
    calls: number;
    charged: number;
    refused_by_check: number;
    revenue_usd: string;
    unique_buyers: number;
    avg_latency_ms: number;
  };
  by_operation: { operation_id: string; calls: number; charged: number; revenue_usd: string }[];
  recent: {
    receipt_id: string;
    operation_id: string;
    at: string;
    price_usd: string;
    check: "passed" | "failed";
    failed_checks: string[];
    charged: boolean;
    buyer: string;
    latency_ms: number;
    door: string;
    channel: string;
  }[];
};

export type Published = { door_url: string; listing_url: string; openapi_url: string };

// The seller token is per seller; the API id picks one of their APIs.
export type Session = { apiId: string; token: string };

export interface MisaClient {
  // Pass the seller's existing token to add another API to the same seller.
  createApi(input: NewApi, token?: string): Promise<{ api_id: string; slug: string; seller_id: string; seller_token: string; draft: Draft }>;
  getApi(session: Session): Promise<Draft>;
  updateApi(session: Session, changes: DraftChanges): Promise<Draft>;
  linkStripe(token: string, urls: { return_url: string; refresh_url: string }): Promise<{ url: string }>;
  publish(session: Session): Promise<Published>;
  usage(session: Session): Promise<Usage>;
}

// A failure the seller can act on, carrying Misa's own explanation.
export class MisaRequestError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = "MisaRequestError";
  }
}

export function httpMisaClient(baseUrl: string, fetchImpl: typeof fetch = fetch): MisaClient {
  async function call<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers: {
          accept: "application/json",
          ...(init.body === undefined ? {} : { "content-type": "application/json" }),
          ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MisaRequestError(503, "Misa could not be reached. Try again in a moment.");
    }
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      throw new MisaRequestError(502, `Misa answered ${res.status} with a body that is not JSON.`);
    }
    if (!res.ok) {
      const detail =
        typeof body === "object" && body !== null && "detail" in body && typeof body.detail === "string"
          ? body.detail
          : `Misa answered ${res.status}.`;
      throw new MisaRequestError(res.status, detail);
    }
    return body as T;
  }

  return {
    createApi: (input, token) => call("/v1/apis", { method: "POST", body: input, token }),
    getApi: (s) => call(`/v1/apis/${s.apiId}`, { token: s.token }),
    updateApi: (s, changes) => call(`/v1/apis/${s.apiId}`, { method: "PATCH", token: s.token, body: changes }),
    linkStripe: (token, urls) => call("/v1/sellers/me/stripe/link", { method: "POST", token, body: urls }),
    publish: (s) => call(`/v1/apis/${s.apiId}/publish`, { method: "POST", token: s.token, body: {} }),
    usage: (s) => call(`/v1/apis/${s.apiId}/usage`, { token: s.token }),
  };
}
