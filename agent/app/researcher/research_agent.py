"""A generic research agent: it answers questions, and when it needs data it doesn't have, it finds a
paid API, tells the user the price, pays per call within the session budget (test USDC through AgentCore
Payments, or XRP held in an XRPL escrow when XRPL_PAYMENTS=1), and cites
what it bought. Nothing in here knows about any particular seller."""

import json
from typing import Any, AsyncIterator, Optional
from urllib.parse import urlparse

from bedrock_agentcore.payments.integrations.strands import (
    AgentCorePaymentsPlugin,
    AgentCorePaymentsPluginConfig,
)
from strands import Agent
from strands.models.bedrock import BedrockModel

from discovery import make_find_paid_apis, make_verify_receipt
from settings import BASE_SEPOLIA, Settings
from spend_policy import make_pre_sign_policy
from xrpl_payments import make_xrpl_http_request

SYSTEM_PROMPT = """You are a research assistant. Answer the user's question accurately and cite your data.

When you need data you don't have (live numbers, company data, prices, records), do this:
1. Call find_paid_apis with a plain description of the data you need.
2. Pick the operation that fits best. Prefer APIs sold through a verified door (Misa checks each answer
   before you are charged, and gives a receipt). Before calling, say in one line which API you're using,
   its price per call, and whether its answers are verified.
3. Call it with http_request, using the exact URL from the search result and filling in its parameters.
   Payment is handled for you: if the API asks for payment, it is paid from your budget and the request
   is retried. You never handle keys or wallets yourself.
4. After a paid call, call verify_receipt with the listing URL (the call URL up to and including
   /x/<slug>) and the receipt id (the X-Misa-Receipt header, or receipt_id in an error body) to confirm
   the answer passed its checks and what you were charged. Trust the data only once it's verified.
5. Make as few paid calls as the question needs. Never repeat a call that already succeeded.
6. If a call fails its check (HTTP 502 with charged: false) or comes back empty, say plainly that the
   answer was broken and you were not charged. You may try one other operation, but don't loop.
7. If a call returns HTTP 502 with charged: "unknown", the payment outcome is still being confirmed. Don't
   treat it as paid or as free and don't retry it; say so, and check its receipt again before you finish.

In your final answer, give the answer first, then a short "Sources" list: for each paid call, the API
name, what it cost, and whether its receipt confirmed the check passed.
"""


def build_agent(
    settings: Settings,
    payment_session_id: Optional[str],
    payment_instrument_id: Optional[str],
) -> Agent:
    tools: list[Any] = [make_find_paid_apis(settings), make_verify_receipt(settings)]
    plugins = []
    if settings.xrpl_payments:
        # XRP escrow from the agent's own XRPL wallet; AgentCore Payments has no XRPL wallet.
        tools.append(make_xrpl_http_request(settings))
    elif settings.payment_manager_arn:
        allowed_host = urlparse(settings.misa_url).hostname if settings.misa_url else None
        plugins.append(
            AgentCorePaymentsPlugin(
                config=AgentCorePaymentsPluginConfig(
                    payment_manager_arn=settings.payment_manager_arn,
                    user_id=settings.payment_user_id,
                    payment_session_id=payment_session_id,
                    payment_instrument_id=payment_instrument_id,
                    region=settings.region,
                    network_preferences_config=[BASE_SEPOLIA],
                    payment_tool_allowlist=["http_request"],
                    # Only the plugin's own http_request may trigger a payment, and only within our rule.
                    allow_unmarked_402_detection=False,
                    pre_sign_policy=make_pre_sign_policy(settings.max_price_per_call_usd, allowed_host),
                )
            )
        )
    else:
        # Without a payment manager the agent can still discover APIs and see their prices.
        from strands.vended_tools.http_request import http_request

        tools.append(http_request)
    return Agent(
        model=BedrockModel(model_id=settings.model_id, region_name=settings.region),
        system_prompt=SYSTEM_PROMPT,
        tools=tools,
        plugins=plugins,
        callback_handler=None,
    )


def _tool_result_summary(block: dict) -> Optional[dict]:
    """Turn an http_request result into a short, human-readable event (status, paid, receipt)."""
    for item in block.get("content") or []:
        text = item.get("text") if isinstance(item, dict) else None
        if not text:
            continue
        payment_required = text.startswith("PAYMENT_REQUIRED: ")
        try:
            payload = json.loads(text[len("PAYMENT_REQUIRED: ") :] if payment_required else text)
        except ValueError:
            return None
        if not isinstance(payload, dict) or "statusCode" not in payload:
            return None
        headers = {k.lower(): v for k, v in (payload.get("headers") or {}).items()}
        body = payload.get("body") if isinstance(payload.get("body"), dict) else {}
        # Only the XRP escrow path adds these (xrpl_payments.py).
        xrpl = {key: payload[key] for key in ("escrow", "payment") if payload.get(key)}
        return {
            "status": payload["statusCode"],
            "payment_required": payment_required,
            "paid": "payment-response" in headers,
            "check": headers.get("x-misa-check"),
            "receipt": headers.get("x-misa-receipt") or body.get("receipt_id"),
            "charged": body.get("charged"),
            "failed_checks": body.get("failed_checks"),
            **xrpl,
        }
    return None


async def stream_events(agent: Agent, prompt: str) -> AsyncIterator[dict]:
    """Small, stable event shapes for the demo client: text, tool, http, done."""
    async for event in agent.stream_async(prompt):
        if not isinstance(event, dict):
            continue
        if "data" in event and isinstance(event["data"], str):
            yield {"type": "text", "text": event["data"]}
        message = event.get("message")
        if isinstance(message, dict):
            for block in message.get("content") or []:
                if "toolUse" in block:
                    use = block["toolUse"]
                    yield {"type": "tool", "name": use.get("name"), "input": use.get("input")}
                elif "toolResult" in block:
                    summary = _tool_result_summary(block["toolResult"])
                    if summary:
                        yield {"type": "http", **summary}
        if "result" in event:
            yield {"type": "done"}
