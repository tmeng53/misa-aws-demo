"""A generic research agent: it answers questions, and when it needs data it doesn't have, it finds a
paid API, tells the user the price, pays per call with test USDC within the session budget, and cites
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

from discovery import make_find_paid_apis
from settings import BASE_SEPOLIA, Settings
from spend_policy import make_pre_sign_policy

SYSTEM_PROMPT = """You are a research assistant. Answer the user's question accurately and cite your data.

When you need data you don't have (live numbers, company data, prices, records), do this:
1. Call find_paid_apis with a plain description of the data you need.
2. Pick the operation that fits best. Before calling it, say in one line which API you're using and its
   price per call.
3. Call it with http_request, using the exact URL from the search result and filling in its parameters.
   Payment is handled for you: if the API asks for payment, it is paid from your budget and the request
   is retried. You never handle keys or wallets yourself.
4. Make as few paid calls as the question needs. Never repeat a call that already succeeded.
5. If a call fails or comes back empty, say so plainly. A failed answer is not charged, so you may try
   one other operation, but don't loop.

In your final answer, give the answer first, then a short "Sources" list: for each paid call, the API
name, what it cost, and its receipt link if the response included an X-Misa-Receipt header
(the receipt link is the listing URL followed by /receipts/<receipt id>).
"""


def build_agent(
    settings: Settings,
    payment_session_id: Optional[str],
    payment_instrument_id: Optional[str],
) -> Agent:
    tools: list[Any] = [make_find_paid_apis(settings)]
    plugins = []
    if settings.payment_manager_arn:
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
        return {
            "status": payload["statusCode"],
            "payment_required": payment_required,
            "paid": "payment-response" in headers,
            "check": headers.get("x-misa-check"),
            "receipt": headers.get("x-misa-receipt"),
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
