"""AgentCore Runtime entrypoint for the research agent.

The caller (the person's app, here scripts/run_demo.py) owns the money: it creates a payment session
with a spend cap and passes its id, plus the wallet (payment instrument) id, as custom headers. The agent
can spend within that session and nothing more.
"""

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from research_agent import build_agent, stream_events
from settings import Settings

HEADER_PREFIX = "x-amzn-bedrock-agentcore-runtime-custom-"

app = BedrockAgentCoreApp()
log = app.logger


@app.entrypoint
async def invoke(payload, context):
    if not isinstance(payload, dict) or not isinstance(payload.get("prompt"), str) or not payload["prompt"].strip():
        yield {"type": "error", "message": "send a JSON body with a non-empty 'prompt'"}
        return
    headers = {k.lower(): v for k, v in (getattr(context, "request_headers", None) or {}).items()}
    session_id = (headers.get(HEADER_PREFIX + "payment-session-id") or "").strip() or None
    instrument_id = (headers.get(HEADER_PREFIX + "payment-instrument-id") or "").strip() or None

    settings = Settings.from_env()
    log.info(
        "research request: payments=%s session=%s gateway=%s catalog=%s",
        bool(settings.payment_manager_arn),
        session_id,
        bool(settings.tool_gateway_url),
        settings.misa_url,
    )
    agent = build_agent(settings, session_id, instrument_id)
    async for event in stream_events(agent, payload["prompt"]):
        yield event


if __name__ == "__main__":
    app.run()
