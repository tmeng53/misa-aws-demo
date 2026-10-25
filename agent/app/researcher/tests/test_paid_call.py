"""Checks the pieces that decide whether the agent pays, against a local door shaped like contract v2.1."""

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
from discovery import make_verify_receipt, search_misa_catalog, tools_from_search_result  # noqa: E402
from research_agent import _tool_result_summary  # noqa: E402
from settings import Settings  # noqa: E402
from spend_policy import check_payment  # noqa: E402

PORT = 4791
MISA = f"http://localhost:{PORT}"
LISTING = f"{MISA}/x/{stub_door.SLUG}"
DOOR = f"{LISTING}/v1/companies/fbk/estimates"
FAKE_ARN = "arn:aws:bedrock-agentcore:us-west-2:111122223333:payment-manager/pm-test"
SIGNATURE = base64.b64encode(json.dumps({"x402Version": 2, "payload": "stub"}).encode()).decode()


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


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("MISA_GATEWAY_URL", MISA)
    return Settings.from_env()


def _payment_request(tool_result):
    handler = get_payment_handler("http_request", {"url": DOOR})
    return {
        "statusCode": handler.extract_status_code(tool_result),
        "headers": handler.extract_headers(tool_result),
        "body": handler.extract_body(tool_result),
    }


def test_unpaid_call_is_seen_as_a_402_with_the_doors_requirement(http_request):
    request = _payment_request(http_request(url=DOOR))
    assert request["statusCode"] == 402
    header = next(v for k, v in request["headers"].items() if k.lower() == "payment-required")
    accept = json.loads(base64.b64decode(header))["accepts"][0]
    assert (accept["amount"], accept["network"], accept["scheme"]) == ("500000", "eip155:84532", "exact")


def test_guard_allows_a_50_cent_call_on_the_misa_host(http_request):
    request = _payment_request(http_request(url=DOOR))
    assert check_payment(request, Decimal("1.00"), "localhost") == (True, "ok")


def test_guard_refuses_a_call_above_the_per_call_limit(http_request):
    request = _payment_request(http_request(url=DOOR))
    assert check_payment(request, Decimal("0.25"), "localhost") == (
        False,
        "price $0.50 is above the $0.25 per-call limit",
    )


def test_guard_refuses_to_pay_a_host_other_than_misa(http_request):
    request = _payment_request(http_request(url=DOOR))
    assert check_payment(request, Decimal("1.00"), "misa.example") == (
        False,
        f"resource '{DOOR}' is not on misa.example",
    )


def test_guard_refuses_what_it_cannot_read():
    assert check_payment({"statusCode": 402, "headers": {}, "body": {"text": "pay me"}}, Decimal("1"), None) == (
        False,
        "no readable x402 payment requirement",
    )


def test_paid_calls_pass_twice_then_fail_the_check_uncharged(http_request, settings):
    verify = make_verify_receipt(settings)

    first = http_request(url=DOOR, headers={"PAYMENT-SIGNATURE": SIGNATURE})
    summary = _tool_result_summary(first)
    assert (summary["status"], summary["paid"], summary["check"]) == (200, True, "passed")
    assert json.loads(first["content"][0]["text"])["body"]["ticker"] == "FBK"
    receipt = verify(listing_url=LISTING, receipt_id=summary["receipt"])["receipt"]
    assert (receipt["check"], receipt["charged"], receipt["amount_usd"]) == ("passed", True, "0.50")

    http_request(url=DOOR, headers={"PAYMENT-SIGNATURE": SIGNATURE})

    third = _tool_result_summary(http_request(url=DOOR, headers={"PAYMENT-SIGNATURE": SIGNATURE}))
    assert (third["status"], third["paid"], third["charged"], third["failed_checks"]) == (
        502,
        False,
        False,
        ["not_empty"],
    )
    receipt = verify(listing_url=LISTING, receipt_id=third["receipt"])["receipt"]
    assert (receipt["check"], receipt["charged"], receipt["outcome"]) == ("failed", False, "refused_by_check")


def test_unknown_settle_is_reported_as_unknown_not_free():
    result = {
        "status": "success",
        "content": [
            {
                "text": json.dumps(
                    {
                        "statusCode": 502,
                        "headers": {"content-type": "application/problem+json"},
                        "body": {"charged": "unknown", "detail": "settlement not confirmed yet"},
                    }
                )
            }
        ],
    }
    assert _tool_result_summary(result) == {
        "status": 502,
        "payment_required": False,
        "paid": False,
        "check": None,
        "receipt": None,
        "charged": "unknown",
        "failed_checks": None,
    }


def test_receipt_lookup_refuses_other_hosts(settings):
    verify = make_verify_receipt(settings)
    assert verify(listing_url="https://evil.example/x/a", receipt_id="r-1") == {
        "error": f"receipts are only looked up on {MISA}"
    }


def test_catalog_search_lists_operations_with_price_and_url(settings):
    assert search_misa_catalog(settings, "earnings estimates") == [
        {
            "api": "Fernbrook Fundamentals",
            "listing": LISTING,
            "operation": "getEstimates",
            "call": f"GET {LISTING}/v1/companies/{{ticker}}/estimates",
            "summary": "Consensus earnings estimates for the next two quarters",
            "price_usd": "0.50",
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
                        "name": "Fernbrook___getEstimates",
                        "description": "Paid per call via x402: GET https://misa.example/x/fb/v1/companies/{ticker}/estimates, $0.50",
                        "inputSchema": {"type": "object", "properties": {"ticker": {"type": "string"}}},
                    }
                ]
            }
        },
    }
    assert tools_from_search_result(rpc) == [
        {
            "tool": "Fernbrook___getEstimates",
            "description": "Paid per call via x402: GET https://misa.example/x/fb/v1/companies/{ticker}/estimates, $0.50",
            "inputs": {"ticker": {"type": "string"}},
        }
    ]
