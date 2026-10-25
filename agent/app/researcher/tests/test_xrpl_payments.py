"""The rules that decide whether the agent pays a door in XRP held in an escrow (no network)."""

import base64
import json
from decimal import Decimal

from spend_policy import check_payment, check_xrp_option, xrp_options
from xrpl_payments import payment_signature

HOST = "api.trymisa.com"
RESOURCE = {"url": f"https://{HOST}/x/fernbrook-fundamentals/v1/companies?q=QLMR"}
USDC = {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "500000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x3b0b371ae3cb08f272b87319684f6518b3b313a0",
    "maxTimeoutSeconds": 300,
    "extra": {"name": "USDC", "version": "2"},
}
XRP = {
    "scheme": "auth-capture",
    "network": "xrpl:1",
    "asset": "XRP",
    "amount": "208334",
    "payTo": "rM66YAsg7nLWkTS1m7FKm7vHZ32qPt4dsn",
    "maxTimeoutSeconds": 60,
    "extra": {
        "paymentFlow": "escrow",
        "operatorType": "custom",
        "orderId": "7d8a8f0e-0000-4000-8000-000000000001",
        "condition": "A0258020" + "AB" * 32 + "810120",
        "captureDeadline": 1793000000,
    },
}
BOTH = {"x402Version": 2, "resource": RESOURCE, "accepts": [USDC, XRP]}


def test_usdc_is_still_paid_when_the_door_also_offers_xrp():
    assert check_payment({"headers": {}, "body": BOTH}, Decimal("1.00"), HOST) == (True, "ok")


def test_an_xrp_only_402_is_not_for_agentcore_payments():
    only_xrp = {**BOTH, "accepts": [XRP]}
    assert check_payment({"headers": {}, "body": only_xrp}, Decimal("1.00"), HOST) == (
        False,
        "no option on eip155:84532",
    )


def test_finds_the_xrp_escrow_option_on_its_network_only():
    assert xrp_options(BOTH, "xrpl:1") == [XRP]
    assert xrp_options(BOTH, "xrpl:0") == []


def test_values_drops_at_its_own_rate_against_the_per_call_limit():
    assert check_xrp_option(BOTH, XRP, Decimal("1.00"), HOST, Decimal("2.40")) == (
        True,
        "ok",
        Decimal("0.5000016"),
    )
    allowed, reason, _ = check_xrp_option(BOTH, XRP, Decimal("0.40"), HOST, Decimal("2.40"))
    assert (allowed, reason) == (False, "price $0.50 is above the $0.40 per-call limit")


def test_refuses_an_escrow_off_the_misa_host():
    elsewhere = {**BOTH, "resource": {"url": "https://evil.example/x/y"}}
    allowed, reason, _ = check_xrp_option(elsewhere, XRP, Decimal("1.00"), HOST, Decimal("2.40"))
    assert (allowed, reason) == (False, f"resource 'https://evil.example/x/y' is not on {HOST}")


def test_payment_signature_carries_the_option_and_the_signed_blob():
    header = payment_signature(XRP, "1200012280000000")
    assert json.loads(base64.b64decode(header)) == {
        "x402Version": 2,
        "accepted": XRP,
        "payload": {"signedTxBlob": "1200012280000000"},
    }
