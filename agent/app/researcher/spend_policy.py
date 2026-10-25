"""The agent's own spending rule, checked by AgentCore Payments before it signs anything.

AgentCore Payments already caps the whole session (maxSpendAmount). This adds two rules per call:
only pay on the demo network in test USDC, and never more than a set price for one call.
Anything we cannot read is refused (the SDK treats any return value other than True as a block).

A door may also offer options AgentCore Payments can't pay (an XRP escrow): those are left to
`xrpl_payments.py` when XRPL_PAYMENTS=1, under the same host and per-call rules (`check_xrp_option`).
"""

import base64
import json
from decimal import Decimal
from typing import Any, Callable, Optional
from urllib.parse import urlparse

from settings import BASE_SEPOLIA, USDC_BASE_SEPOLIA, USDC_DECIMALS, XRP_DROPS


def _payment_required(request: Any) -> Optional[dict]:
    """Return the x402 v2 PaymentRequired object from a 402 response, header first, then body."""
    if not isinstance(request, dict):
        return None
    for key, value in (request.get("headers") or {}).items():
        if key.lower() == "payment-required" and isinstance(value, str):
            try:
                decoded = json.loads(base64.b64decode(value))
            except ValueError:
                return None
            return decoded if isinstance(decoded, dict) else None
    body = request.get("body")
    if isinstance(body, dict) and "accepts" in body:
        return body
    return None


def usd_from_atomic(amount: str) -> Decimal:
    return Decimal(int(amount)) / (Decimal(10) ** USDC_DECIMALS)


def check_payment(request: Any, max_price_usd: Decimal, allowed_host: Optional[str]) -> tuple[bool, str]:
    """Decide whether one 402 is acceptable. Returns (allowed, reason) so tests can assert the reason."""
    required = _payment_required(request)
    if required is None:
        return False, "no readable x402 payment requirement"
    if allowed_host:
        resource_url = (required.get("resource") or {}).get("url") or ""
        if urlparse(resource_url).hostname != allowed_host:
            return False, f"resource {resource_url!r} is not on {allowed_host}"
    accepts = required.get("accepts")
    if not isinstance(accepts, list) or not accepts:
        return False, "no payment options offered"
    if not all(isinstance(option, dict) for option in accepts):
        return False, "malformed payment option"
    # The plugin pays an option on its preferred network; options for other networks are ignored.
    ours = [option for option in accepts if option.get("network") == BASE_SEPOLIA]
    if not ours:
        return False, f"no option on {BASE_SEPOLIA}"
    for option in ours:
        if option.get("scheme") != "exact":
            return False, f"unsupported scheme {option.get('scheme')} on {BASE_SEPOLIA}"
        if str(option.get("asset", "")).lower() != USDC_BASE_SEPOLIA.lower():
            return False, f"unsupported asset {option.get('asset')}"
        try:
            price = usd_from_atomic(str(option.get("amount")))
        except ValueError:
            return False, "unreadable amount"
        if price > max_price_usd:
            return False, f"price ${price:.2f} is above the ${max_price_usd:.2f} per-call limit"
    return True, "ok"


def xrp_options(required: Any, network: str) -> list[dict]:
    """The XRP escrow options in a PaymentRequired, on the network the agent's XRPL wallet is on."""
    accepts = required.get("accepts") if isinstance(required, dict) else None
    return [
        option
        for option in accepts or []
        if isinstance(option, dict)
        and option.get("scheme") == "auth-capture"
        and option.get("network") == network
        and option.get("asset") == "XRP"
        and isinstance(option.get("extra"), dict)
        and option["extra"].get("paymentFlow") == "escrow"
    ]


def check_xrp_option(
    required: Any, option: dict, max_price_usd: Decimal, allowed_host: Optional[str], xrp_usd: Decimal
) -> tuple[bool, str, Decimal]:
    """The same per-call rule for an XRP escrow. The 402 quotes drops, so the price is valued at our own
    XRP rate. Returns (allowed, reason, price in USD)."""
    if allowed_host:
        resource_url = ((required or {}).get("resource") or {}).get("url") or ""
        if urlparse(resource_url).hostname != allowed_host:
            return False, f"resource {resource_url!r} is not on {allowed_host}", Decimal(0)
    extra = option.get("extra") or {}
    if not extra.get("condition") or not isinstance(extra.get("captureDeadline"), int):
        return False, "the escrow option has no condition or deadline", Decimal(0)
    try:
        price = Decimal(int(str(option.get("amount")))) / XRP_DROPS * xrp_usd
    except ValueError:
        return False, "unreadable amount", Decimal(0)
    if price > max_price_usd:
        return False, f"price ${price:.2f} is above the ${max_price_usd:.2f} per-call limit", price
    return True, "ok", price


def make_pre_sign_policy(max_price_usd: Decimal, allowed_host: Optional[str]) -> Callable[[Any], bool]:
    def policy(request: Any) -> bool:
        allowed, _ = check_payment(request, max_price_usd, allowed_host)
        return allowed

    return policy
