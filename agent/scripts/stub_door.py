"""A local stand-in for Misa's paid door, shaped like contract.md v1, for testing the agent without the
real gateway. It does NOT verify or settle payments: any well-formed PAYMENT-SIGNATURE is accepted.

    python scripts/stub_door.py --port 4020
"""

import argparse
import base64
import json
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
PAY_TO = "0x000000000000000000000000000000000000dEaD"
SLUG = "northwind-fundamentals"
PRICE_ATOMIC = "15000"  # $0.015


def _b64(obj) -> str:
    return base64.b64encode(json.dumps(obj).encode()).decode()


class Door(BaseHTTPRequestHandler):
    base_url = "http://localhost:4020"

    def _send(self, status: int, body, headers=None):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass

    def do_GET(self):
        url = urlparse(self.path)
        door = f"{self.base_url}/x/{SLUG}"
        if url.path == "/v1/listings":
            return self._send(
                200,
                [
                    {
                        "slug": SLUG,
                        "name": "Northwind Fundamentals",
                        "description": "Company fundamentals and earnings estimates by ticker",
                        "door_url": door,
                        "openapi_url": f"{door}/openapi.json",
                        "operations": [
                            {
                                "operation_id": "getEarningsEstimates",
                                "method": "GET",
                                "path": "/v1/companies/{ticker}/estimates",
                                "summary": "Consensus earnings estimates for upcoming quarters",
                                "price_usd": "0.015",
                            }
                        ],
                    }
                ],
            )
        if url.path.startswith(f"/x/{SLUG}/v1/companies/") and url.path.endswith("/estimates"):
            requirement = {
                "x402Version": 2,
                "error": "payment required",
                "resource": {"url": f"{self.base_url}{url.path}", "description": "Earnings estimates", "mimeType": "application/json"},
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
            signature = self.headers.get("PAYMENT-SIGNATURE")
            if not signature:
                return self._send(402, requirement, {"PAYMENT-REQUIRED": _b64(requirement)})
            try:
                json.loads(base64.b64decode(signature))
            except ValueError:
                return self._send(402, {**requirement, "error": "invalid payment signature"}, {"PAYMENT-REQUIRED": _b64(requirement)})
            ticker = url.path.split("/")[-2].upper()
            receipt = str(uuid.uuid4())
            return self._send(
                200,
                {"ticker": ticker, "estimates": [{"quarter": "2026Q4", "eps_consensus": 1.12, "revenue_consensus_musd": 842.0}]},
                {
                    "PAYMENT-RESPONSE": _b64({"success": True, "transaction": "stub", "network": "eip155:84532"}),
                    "X-Misa-Check": "passed",
                    "X-Misa-Receipt": receipt,
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
