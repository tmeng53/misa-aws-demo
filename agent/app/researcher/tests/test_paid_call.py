"""Checks the pieces that decide whether the agent pays, against a local door shaped like the contract."""

import base64
import json
import sys
import threading
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import stub_door  # noqa: E402
from bedrock_agentcore.payments.integrations.handlers import get_payment_handler  # noqa: E402
from bedrock_agentcore.payments.integrations.strands import (  # noqa: E402
    AgentCorePaymentsPlugin,
    AgentCorePaymentsPluginConfig,
)
from discovery import search_misa_catalog, tools_from_search_result  # noqa: E402
from research_agent import _tool_result_summary  # noqa: E402
from settings import Settings  # noqa: E402
from spend_policy import check_payment  # noqa: E402

PORT = 4791
DOOR = f"http://localhost:{PORT}/x/{stub_door.SLUG}/v1/companies/nwnd/estimates"
FAKE_ARN = "arn:aws:bedrock-agentcore:us-west-2:111122223333:payment-manager/pm-test"


@pytest.fixture(scope="module", autouse=True)
def door():
    server = stub_door.serve(PORT)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield
    server.shutdown()


@pytest.fixture(scope="module")
def http_request():
    plugin = AgentCorePaymentsPlugin(
        config=AgentCorePaymentsPluginConfig(payment_manager_arn=FAKE_ARN, user_id="u", region="us-west-2")
    )
    return plugin.http_request


def _payment_request(tool_result):
    handler = get_payment_handler("http_request", {"url": DOOR})
    return {
        "statusCode": handler.extract_status_code(tool_result),
        "headers": handler.extract_headers(tool_result),
        "body": handler.extract_body(tool_result),
    }


def test_unpaid_call_is_seen_as_a_402_with_the_doors_requirement(http_request):
    result = http_request(url=DOOR)
    request = _payment_request(result)
    assert request["statusCode"] == 402
    header = next(v for k, v in request["headers"].items() if k.lower() == "payment-required")
    decoded = json.loads(base64.b64decode(header))
    assert decoded["accepts"][0]["amount"] == "15000"
    assert decoded["accepts"][0]["network"] == "eip155:84532"


def test_policy_allows_a_cheap_call_on_the_misa_host(http_request):
    request = _payment_request(http_request(url=DOOR))
    assert check_payment(request, Decimal("0.05"), "localhost") == (True, "ok")


def test_policy_refuses_a_call_above_the_per_call_limit(http_request):
    request = _payment_request(http_request(url=DOOR))
    assert check_payment(request, Decimal("0.01"), "localhost") == (
        False,
        "price $0.015 is above the $0.01 per-call limit",
    )


def test_policy_refuses_to_pay_a_host_other_than_misa(http_request):
    request = _payment_request(http_request(url=DOOR))
    assert check_payment(request, Decimal("0.05"), "misa.example") == (
        False,
        f"resource 'http://localhost:{PORT}/x/{stub_door.SLUG}/v1/companies/nwnd/estimates' is not on misa.example",
    )


def test_policy_refuses_what_it_cannot_read():
    assert check_payment({"statusCode": 402, "headers": {}, "body": {"text": "pay me"}}, Decimal("1"), None) == (
        False,
        "no readable x402 payment requirement",
    )


def test_paid_call_returns_the_answer_and_receipt(http_request):
    signature = base64.b64encode(json.dumps({"x402Version": 2, "payload": "stub"}).encode()).decode()
    result = http_request(url=DOOR, headers={"PAYMENT-SIGNATURE": signature})
    summary = _tool_result_summary(result)
    assert summary["status"] == 200
    assert summary["paid"] is True
    assert summary["check"] == "passed"
    assert len(summary["receipt"]) == 36
    body = json.loads(result["content"][0]["text"])["body"]
    assert body["ticker"] == "NWND"


def test_catalog_search_lists_operations_with_price_and_url(monkeypatch):
    monkeypatch.setenv("MISA_GATEWAY_URL", f"http://localhost:{PORT}")
    found = search_misa_catalog(Settings.from_env(), "earnings estimates")
    assert found == [
        {
            "api": "Northwind Fundamentals",
            "listing": f"http://localhost:{PORT}/x/{stub_door.SLUG}",
            "operation": "getEarningsEstimates",
            "call": f"GET http://localhost:{PORT}/x/{stub_door.SLUG}/v1/companies/{{ticker}}/estimates",
            "summary": "Consensus earnings estimates for upcoming quarters",
            "price_usd": "0.015",
        }
    ]


def test_gateway_search_result_is_flattened_to_tools():
    rpc = {
        "jsonrpc": "2.0",
        "id": "x",
        "result": {
            "structuredContent": {
                "tools": [
                    {
                        "name": "northwind___getEarningsEstimates",
                        "description": "Paid per call via x402: GET https://misa.example/x/nw/v1/companies/{ticker}/estimates, $0.015",
                        "inputSchema": {"type": "object", "properties": {"ticker": {"type": "string"}}},
                    }
                ]
            }
        },
    }
    assert tools_from_search_result(rpc) == [
        {
            "tool": "northwind___getEarningsEstimates",
            "description": "Paid per call via x402: GET https://misa.example/x/nw/v1/companies/{ticker}/estimates, $0.015",
            "inputs": {"ticker": {"type": "string"}},
        }
    ]
