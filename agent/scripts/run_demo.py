"""Run one research task the way a person's app would: give the agent a budget, ask, watch it work.

1. Creates an AgentCore payment session capped at --budget (USD) for --minutes.
2. Invokes the research agent on AgentCore Runtime (or a local `agentcore dev` server with --local),
   passing the session and wallet ids as headers. The agent cannot spend outside that session.
3. Prints what the agent searched, what it paid, the answer, and how much of the budget is left.

    RUNTIME_ARN=... python scripts/run_demo.py "Which software companies report earnings next week, and what does the consensus expect?"
"""

import argparse
import json
import os
import sys
import uuid
from decimal import Decimal

import boto3
import httpx
from bedrock_agentcore.payments import PaymentManager
from setup_wallet import load_state

PREFIX = "X-Amzn-Bedrock-AgentCore-Runtime-Custom-"


def events_from_sse(lines):
    for raw in lines:
        line = raw.decode() if isinstance(raw, bytes) else raw
        if line.startswith("data:"):
            data = line[len("data:") :].strip()
            if data:
                try:
                    yield json.loads(data)
                except ValueError:
                    continue


def invoke_remote(runtime_arn: str, region: str, prompt: str, headers: dict):
    client = boto3.client("bedrock-agentcore", region_name=region)

    def add_headers(request, **_):
        for key, value in headers.items():
            request.headers[key] = value

    client.meta.events.register("before-sign.bedrock-agentcore.InvokeAgentRuntime", add_headers)
    response = client.invoke_agent_runtime(
        agentRuntimeArn=runtime_arn,
        runtimeSessionId=f"research-{uuid.uuid4()}",
        payload=json.dumps({"prompt": prompt}).encode(),
        contentType="application/json",
        accept="text/event-stream",
    )
    yield from events_from_sse(response["response"].iter_lines())


def invoke_local(port: int, prompt: str, headers: dict):
    with httpx.stream(
        "POST",
        f"http://localhost:{port}/invocations",
        json={"prompt": prompt},
        headers={**headers, "Accept": "text/event-stream"},
        timeout=300.0,
    ) as response:
        yield from events_from_sse(response.iter_lines())


def render(event: dict) -> None:
    kind = event.get("type")
    if kind == "text":
        print(event["text"], end="", flush=True)
    elif kind == "tool":
        args = json.dumps(event.get("input"), ensure_ascii=False)
        print(f"\n\n  → {event.get('name')} {args[:200]}", flush=True)
    elif kind == "http":
        if event.get("payment_required"):
            print("  ← 402 payment required: paying from the session budget", flush=True)
        elif event.get("charged") is False:
            failed = ", ".join(event.get("failed_checks") or []) or "answer check"
            print(f"  ← {event.get('status')} answer failed Misa's check ({failed}): not charged\n", flush=True)
        else:
            paid = "paid" if event.get("paid") else "not charged"
            check = f", check {event['check']}" if event.get("check") else ""
            receipt = f", receipt {event['receipt']}" if event.get("receipt") else ""
            print(f"  ← {event.get('status')} ({paid}{check}{receipt})\n", flush=True)
    elif kind == "error":
        print(f"\n[error] {event.get('message')}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("prompt")
    parser.add_argument("--budget", default="0.10", help="session spend cap in USD")
    parser.add_argument("--minutes", type=int, default=15, help="session lifetime (15-480)")
    parser.add_argument("--local", action="store_true", help="call `agentcore dev` on localhost instead")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--region", default=os.environ.get("AWS_DEFAULT_REGION", "us-west-2"))
    args = parser.parse_args()

    state = load_state()
    manager_arn = os.environ.get("PAYMENT_MANAGER_ARN") or state.get("payment_manager_arn")
    instrument_id = os.environ.get("PAYMENT_INSTRUMENT_ID") or state.get("payment_instrument_id")
    user_id = state.get("payment_user_id", "demo-buyer")
    if not manager_arn or not instrument_id:
        print("run scripts/setup_wallet.py first", file=sys.stderr)
        return 2

    manager = PaymentManager(payment_manager_arn=manager_arn, region_name=args.region)
    session = manager.create_payment_session(
        user_id=user_id,
        limits={"maxSpendAmount": {"value": args.budget, "currency": "USD"}},
        expiry_time_in_minutes=args.minutes,
    )
    session_id = session["paymentSessionId"]
    print(f"Budget for this task: ${args.budget} (expires in {args.minutes} min)\n")
    print(f"Question: {args.prompt}\n")

    headers = {PREFIX + "Payment-Session-Id": session_id, PREFIX + "Payment-Instrument-Id": instrument_id}
    if args.local:
        stream = invoke_local(args.port, args.prompt, headers)
    else:
        runtime_arn = os.environ.get("RUNTIME_ARN") or state.get("runtime_arn")
        if not runtime_arn:
            print("set RUNTIME_ARN (see `agentcore status --json`) or use --local", file=sys.stderr)
            return 2
        stream = invoke_remote(runtime_arn, args.region, args.prompt, headers)
    for event in stream:
        render(event)

    after = manager.get_payment_session(user_id=user_id, payment_session_id=session_id)
    left = Decimal(after["availableLimits"]["availableSpendAmount"]["value"])
    print(f"\n\nSpent ${Decimal(args.budget) - left} of ${args.budget}. Left in this session: ${left}.")
    if state.get("payment_connector_id"):
        balance = manager.get_payment_instrument_balance(
            user_id=user_id,
            payment_connector_id=state["payment_connector_id"],
            payment_instrument_id=instrument_id,
            chain="BASE_SEPOLIA",
            token="USDC",
        )["tokenBalance"]
        print(f"Wallet balance: {balance['amount']} {balance['token']} (test money)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
