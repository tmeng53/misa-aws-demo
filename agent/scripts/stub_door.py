"""A local stand-in for Misa's paid door, shaped like contract.md v2.1, for testing the agent without the
real service. It does NOT verify or settle payments: any well-formed PAYMENT-SIGNATURE is accepted.
Like Fernbrook, every third paid call fails Misa's check and is not charged.

    python scripts/stub_door.py --port 4020
"""

import argparse
import base64
import itertools
import json
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
PAY_TO = "0x000000000000000000000000000000000000dEaD"
SLUG = "fernbrook-fundamentals"
PRICE_ATOMIC = "500000"  # $0.50
PRICE_USD = "0.50"


def _b64(obj) -> str:
    return base64.b64encode(json.dumps(obj).encode()).decode()


class Door(BaseHTTPRequestHandler):
    base_url = "http://localhost:4020"
    paid_calls = itertools.count(1)
    receipts: dict = {}
    lock = threading.Lock()

    def _send(self, status: int, body, headers=None, content_type="application/json"):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass

    def _requirement(self, path: str) -> dict:
        return {
            "x402Version": 2,
            "error": "payment required",
            "resource": {"url": f"{self.base_url}{path}", "description": "Earnings estimates", "mimeType": "application/json"},
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "eip155:84532",
                    "amount": PRICE_ATOMIC,
                    "asset": USDC,
                    "payTo": PAY_TO,
                    "maxTimeoutSeconds": 300,
                    "extra": {"name": "USDC", "version": "2"},
                }
            ],
        }

    def _receipt(self, passed: bool) -> dict:
        receipt_id = str(uuid.uuid4())
        receipt = {
            "receipt_id": receipt_id,
            "check": "passed" if passed else "failed",
            "failed_checks": [] if passed else ["not_empty"],
            "charged": passed,
            "amount_usd": PRICE_USD if passed else "0.00",
            "outcome": "settled" if passed else "refused_by_check",
            "at": "2026-10-25T12:00:00Z",
            "receipt": {"stub": True},
            "signature": "stub",
            "key_id": "stub",
            "verify_with": f"{self.base_url}/.well-known/misa-receipt-keys.json",
        }
        with self.lock:
            self.receipts[receipt_id] = receipt
        return receipt

    def do_GET(self):
        url = urlparse(self.path)
        door = f"{self.base_url}/x/{SLUG}"
        if url.path == "/v1/listings":
            return self._send(
                200,
                [
                    {
                        "slug": SLUG,
                        "name": "Fernbrook Fundamentals",
                        "description": "Company fundamentals and earnings estimates by ticker",
                        "door_url": door,
                        "openapi_url": f"{door}/openapi.json",
                        "operations": [
                            {
                                "operation_id": "getEstimates",
                                "method": "GET",
                                "path": "/v1/companies/{ticker}/estimates",
                                "summary": "Consensus earnings estimates for the next two quarters",
                                "price_usd": PRICE_USD,
                            }
                        ],
                    }
                ],
            )
        if url.path.startswith(f"/x/{SLUG}/receipts/"):
            receipt = self.receipts.get(url.path.rsplit("/", 1)[-1])
            if receipt is None:
                return self._send(404, {"type": "about:blank", "title": "Not found", "status": 404})
            return self._send(200, receipt)
        if url.path.startswith(f"/x/{SLUG}/v1/companies/") and url.path.endswith("/estimates"):
            requirement = self._requirement(url.path)
            signature = self.headers.get("PAYMENT-SIGNATURE")
            if not signature:
                return self._send(402, requirement, {"PAYMENT-REQUIRED": _b64(requirement)})
            try:
                json.loads(base64.b64decode(signature))
            except ValueError:
                bad = {**requirement, "error": "invalid payment signature"}
                return self._send(402, bad, {"PAYMENT-REQUIRED": _b64(bad)})
            with self.lock:
                call = next(self.paid_calls)
            if call % 3 == 0:
                receipt = self._receipt(passed=False)
                return self._send(
                    502,
                    {
                        "type": "https://trymisa.com/problems/answer-check-failed",
                        "title": "The seller's answer failed Misa's check",
                        "status": 502,
                        "detail": "The answer was empty. You were not charged.",
                        "charged": False,
                        "failed_checks": ["not_empty"],
                        "checks": [{"name": "not_empty", "passed": False, "detail": "results is empty"}],
                        "receipt_id": receipt["receipt_id"],
                    },
                    content_type="application/problem+json",
                )
            receipt = self._receipt(passed=True)
            ticker = url.path.split("/")[-2].upper()
            return self._send(
                200,
                {"ticker": ticker, "estimates": [{"quarter": "2026Q4", "eps_consensus": 1.12, "revenue_consensus_musd": 842.0}]},
                {
                    "PAYMENT-RESPONSE": _b64({"success": True, "transaction": "stub", "network": "eip155:84532"}),
                    "X-Misa-Check": "passed",
                    "X-Misa-Receipt": receipt["receipt_id"],
                },
            )
        return self._send(404, {"type": "about:blank", "title": "Not found", "status": 404})


def serve(port: int) -> ThreadingHTTPServer:
    Door.base_url = f"http://localhost:{port}"
    return ThreadingHTTPServer(("127.0.0.1", port), Door)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4020)
    args = parser.parse_args()
    print(f"stub door on http://localhost:{args.port}")
    serve(args.port).serve_forever()
