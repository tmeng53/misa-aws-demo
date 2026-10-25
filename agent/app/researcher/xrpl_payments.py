"""Paying a Misa door in XRP held in an XRPL escrow (x402 `auth-capture`, `paymentFlow: escrow`).

AgentCore Payments has no XRPL wallet, so this path signs with the agent's own XRPL testnet wallet
(seed in the runtime env `XRPL_BUYER_SEED`, never in code or logs). It is used only when
`XRPL_PAYMENTS=1`; otherwise the agent pays USDC through AgentCore Payments as before.

The agent signs an EscrowCreate to the seller, locked by Misa's condition and expiring at Misa's
deadline, and sends it in PAYMENT-SIGNATURE. It does not submit it: Misa's facilitator submits it
before the seller is called, and finishes it (XRP to the seller) only when the answer passes its
checks. A failed answer is never finished; the escrow returns to the agent after `CancelAfter`.
"""

import base64
import json
from decimal import Decimal
from threading import Lock
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from strands import tool
from xrpl.clients import JsonRpcClient
from xrpl.ledger import get_latest_validated_ledger_sequence
from xrpl.models.transactions import EscrowCreate
from xrpl.transaction import autofill, sign
from xrpl.wallet import Wallet

from settings import Settings
from spend_policy import check_xrp_option, xrp_options

# Seconds between the Unix epoch and the XRP Ledger's (2000-01-01).
RIPPLE_EPOCH_OFFSET = 946_684_800
# The facilitator refuses an EscrowCreate that could still land long after the 402 (about a minute):
# 15 validated ledgers is ~50 s on testnet, inside the option's maxTimeoutSeconds of 60.
LEDGERS_TO_LAND = 15


def _decode(value: Optional[str]) -> Optional[dict]:
    if not value:
        return None
    try:
        decoded = json.loads(base64.b64decode(value))
    except ValueError:
        return None
    return decoded if isinstance(decoded, dict) else None


def sign_escrow(option: dict, wallet: Wallet, client: JsonRpcClient) -> tuple[str, str, int]:
    """Sign the EscrowCreate the option asks for. Returns (signed blob, its hash, its sequence)."""
    extra = option["extra"]
    tx = autofill(
        EscrowCreate(
            account=wallet.classic_address,
            destination=option["payTo"],
            amount=str(option["amount"]),
            condition=extra["condition"],
            cancel_after=int(extra["captureDeadline"]) - RIPPLE_EPOCH_OFFSET,
        ),
        client,
    )
    fields = tx.to_dict()
    fields["last_ledger_sequence"] = get_latest_validated_ledger_sequence(client) + LEDGERS_TO_LAND
    signed = sign(EscrowCreate.from_dict(fields), wallet)
    return signed.blob(), signed.get_hash(), signed.sequence


def payment_signature(option: dict, blob: str) -> str:
    payload = {"x402Version": 2, "accepted": option, "payload": {"signedTxBlob": blob}}
    return base64.b64encode(json.dumps(payload).encode()).decode()


def _result(response: httpx.Response, **extra: Any) -> dict:
    """Same shape as the AgentCore Payments plugin's http_request result, plus what XRPL adds."""
    try:
        body: Any = response.json()
    except ValueError:
        body = response.text
    payload = {"statusCode": response.status_code, "headers": dict(response.headers), "body": body, **extra}
    return {"status": "success", "content": [{"text": json.dumps(payload)}]}


class XrplBudget:
    """What this runtime may still lock in escrows, in USD. Locked XRP counts until it is known to be back."""

    def __init__(self, limit_usd: Decimal):
        self._left = limit_usd
        self._lock = Lock()

    def take(self, usd: Decimal) -> bool:
        with self._lock:
            if usd > self._left:
                return False
            self._left -= usd
            return True


def make_xrpl_http_request(settings: Settings):
    if not settings.xrpl_buyer_seed:
        raise ValueError("XRPL_PAYMENTS=1 needs XRPL_BUYER_SEED")
    wallet = Wallet.from_seed(settings.xrpl_buyer_seed)
    client = JsonRpcClient(settings.xrpl_rpc_url)
    budget = XrplBudget(settings.xrpl_budget_usd)
    # Each EscrowCreate takes the account's next Sequence, and Misa submits it only after the retry
    # arrives. Two payments signed at once would share a Sequence and the second would be refused,
    # so sign and send one payment at a time.
    paying = Lock()
    allowed_host = urlparse(settings.misa_url).hostname if settings.misa_url else None

    @tool
    def http_request(method: str, url: str, headers: Optional[dict] = None, body: Optional[str] = None) -> dict:
        """Make an HTTP request. If the API asks for payment (HTTP 402) and offers XRP held in escrow,
        it is paid from your budget and the request is retried once. You never handle keys or wallets.

        Args:
            method: HTTP method, e.g. GET.
            url: The full URL, with query parameters filled in.
            headers: Optional request headers.
            body: Optional request body.
        """
        request_headers = dict(headers or {})
        with httpx.Client(timeout=120.0) as http:
            first = http.request(method, url, headers=request_headers, content=body)
            if first.status_code != 402:
                return _result(first)
            required = _decode(first.headers.get("payment-required"))
            if required is None and first.headers.get("content-type", "").startswith("application/json"):
                required = first.json()
            options = xrp_options(required, settings.xrpl_network)
            if not options:
                return _result(first, payment="refused: no XRP escrow option on this network")
            option = options[0]
            allowed, reason, usd = check_xrp_option(
                required, option, settings.max_price_per_call_usd, allowed_host, settings.xrp_usd_rate
            )
            if not allowed:
                return _result(first, payment=f"refused: {reason}")
            if not budget.take(usd):
                return _result(first, payment="refused: the XRP budget for this task is spent")
            with paying:
                blob, escrow_create, sequence = sign_escrow(option, wallet, client)
                request_headers["PAYMENT-SIGNATURE"] = payment_signature(option, blob)
                paid = http.request(method, url, headers=request_headers, content=body)
        settled = _decode(paid.headers.get("payment-response")) or {}
        escrow = {
            "escrow_create": escrow_create,
            "escrow_sequence": sequence,
            "drops": option["amount"],
            "escrow_finish": settled.get("transaction") or None,
        }
        return _result(paid, escrow=escrow)

    return http_request
