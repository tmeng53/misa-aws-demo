"""The agent's own spending rule, checked by AgentCore Payments before it signs anything.

AgentCore Payments already caps the whole session (maxSpendAmount). This adds two rules per call:
only pay on the demo network in test USDC, and never more than a set price for one call.
Anything we cannot read is refused (the SDK treats any return value other than True as a block).
"""

import base64
import json
from decimal import Decimal
from typing import Any, Callable, Optional
from urllib.parse import urlparse

from settings import BASE_SEPOLIA, USDC_BASE_SEPOLIA, USDC_DECIMALS


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
    for option in accepts:
        if not isinstance(option, dict):
            return False, "malformed payment option"
        if option.get("scheme") != "exact" or option.get("network") != BASE_SEPOLIA:
            return False, f"unsupported scheme or network {option.get('scheme')}/{option.get('network')}"
        if str(option.get("asset", "")).lower() != USDC_BASE_SEPOLIA.lower():
            return False, f"unsupported asset {option.get('asset')}"
        try:
            price = usd_from_atomic(str(option.get("amount")))
        except ValueError:
            return False, "unreadable amount"
        if price > max_price_usd:
            return False, f"price ${price:.2f} is above the ${max_price_usd:.2f} per-call limit"
    return True, "ok"


def make_pre_sign_policy(max_price_usd: Decimal, allowed_host: Optional[str]) -> Callable[[Any], bool]:
    def policy(request: Any) -> bool:
        allowed, _ = check_payment(request, max_price_usd, allowed_host)
        return allowed

    return policy
