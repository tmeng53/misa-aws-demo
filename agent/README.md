# Research agent on AgentCore

A generic research agent that has never heard of the seller. When it needs data it doesn't have, it
finds a paid API through **AgentCore Gateway semantic tool search**, tells you the price, pays per call
in test USDC through **AgentCore Payments** (x402 on Base Sepolia), and cites a receipt. You give it a
budget for the task; it cannot spend more.

```
you ── budget $2 ────► payment session (AgentCore Payments, maxSpendAmount)
 │
 └─ question ──► research agent (Strands on AgentCore Runtime)
                   │ find_paid_apis ──► AgentCore Gateway search ──► Misa door OpenAPI target
                   │                     (fallback: Misa catalog GET /v1/listings?q=)
                   └ http_request ──► Misa door ── 402 ──► plugin pays ──► 200 + receipt
```

## What's here

| Path | What |
| --- | --- |
| `agentcore/agentcore.json` | AgentCore project: Runtime `researcher`, payment manager `MisaBuyerPayments` (Coinbase quick create, $1 default cap, Base Sepolia, only `http_request` may pay), Gateway `MisaDiscovery` (MCP, semantic search, IAM auth) |
| `app/researcher/` | The agent. `research_agent.py` (prompt, tools, payments plugin), `discovery.py` (Gateway search + catalog), `spend_policy.py` (per-call rule), `main.py` (Runtime entrypoint) |
| `scripts/setup_wallet.py` | Creates the buyer's wallet and prints the link to authorize and fund it |
| `scripts/register_listing.py` | Adds a Misa door's OpenAPI to the Gateway so search can find it |
| `scripts/run_demo.py` | Creates a budgeted session, runs one question, prints what was paid and what's left |
| `scripts/presenter_demo.py` | Opens the live Fernbrook site with no API key and stops on the 401 |
| `scripts/stub_door.py` | Local stand-in for a Misa door (no real payments), for tests |

## Spending rules

1. **Session cap** (AgentCore Payments): `run_demo.py --budget 2.00` creates a session that can spend at most $2 and expires after 15 minutes.
2. **Per-call guard** (the payments plugin's built-in `pre_sign_policy`, rules in `spend_policy.py`): only x402 `exact` on Base Sepolia in USDC, only on the Misa host (`MISA_GATEWAY_URL`), and at most `MAX_PRICE_PER_CALL_USD` (default $1) per call. Prices are $0.50 a call. Anything it can't read is refused.
3. Only the plugin's own `http_request` tool can trigger a payment (`allow_unmarked_402_detection=False`).

There is no wallet or payment code of our own: AgentCore Payments holds the wallet, enforces the budget and pays. Misa's door settles only after the seller's answer passes its checks, so a broken answer costs nothing.

## Setup (once)

Needs Python 3.10+, Node 20+, `uv`, AWS credentials for an account in **us-west-2** with Claude on Bedrock enabled, and a subscription to "Coinbase Wallets for AgentCore Payments" in AWS Marketplace.

```sh
npm install -g @aws/agentcore
cd agent
printf '%s' "agentcore-research-demo" | agentcore add credentials api-key --name MisaBuyerId --api-key -   # writes agentcore/.env.local
MISA_GATEWAY_URL=https://<misa> python scripts/register_listing.py <slug>
agentcore deploy            # prints a Coinbase link: open it and authorize (quick create)
agentcore status --json     # note the payment manager ARN, connector id, runtime ARN
PAYMENT_MANAGER_ARN=... PAYMENT_CONNECTOR_ID=... python scripts/setup_wallet.py --email you@example.com --wait
# open the printed link: allow the agent to sign, then add test USDC from https://faucet.circle.com (Base Sepolia)
```

Runtime environment variables: `MISA_GATEWAY_URL` (catalog and the only host it pays), optional `MODEL_ID` (default `global.anthropic.claude-sonnet-5-5`), `MAX_PRICE_PER_CALL_USD`. The Gateway URL and payment manager ARN are injected by `agentcore deploy`.

## Presenter: the human site blocks the agent

An agent opens the live Fernbrook homepage, asks for QLMR estimates with no API key, and stops when the site returns 401. It does not sign up, send a key, or call Misa. From the repository root:

```sh
python agent/scripts/presenter_demo.py
```

## Run

```sh
RUNTIME_ARN=... python scripts/run_demo.py --budget 2.00 \
  "Which software companies report earnings next week, and what does the consensus expect?"
```

Locally: `agentcore dev` in one terminal, `python scripts/run_demo.py --local "..."` in another.

## Tests

```sh
cd app/researcher && uv run --group dev pytest
```

They run the plugin's real `http_request` against `scripts/stub_door.py` and check 402 detection, the
per-call rule, receipt parsing and discovery parsing. They don't move money; the end-to-end run does.
