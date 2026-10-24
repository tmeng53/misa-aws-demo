"""How the agent finds paid APIs it has never heard of.

1. AgentCore Gateway semantic tool search (`x_amz_bedrock_agentcore_search`). Misa's door OpenAPI is
   registered as a Gateway target, so its operations show up as tools with their price and door URL
   in the description.
2. Misa's public catalog (`GET /v1/listings?q=`), when no Gateway is configured or it finds nothing.
"""

import json
from typing import Any, Optional

import boto3
import httpx
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from strands import tool

from settings import Settings

SEARCH_TOOL = "x_amz_bedrock_agentcore_search"
MCP_PROTOCOL_VERSION = "2025-11-25"


class _SigV4(httpx.Auth):
    """Signs each request for a Gateway whose inbound auth is AWS_IAM."""

    def __init__(self, region: str):
        self._region = region
        self._session = boto3.Session()

    def auth_flow(self, request: httpx.Request):
        credentials = self._session.get_credentials().get_frozen_credentials()
        signed = AWSRequest(
            method=request.method,
            url=str(request.url),
            data=request.content,
            headers={k: v for k, v in request.headers.items() if k.lower() in ("content-type", "accept", "host")},
        )
        SigV4Auth(credentials, "bedrock-agentcore", self._region).add_auth(signed)
        for key, value in signed.headers.items():
            request.headers[key] = value
        yield request


def _parse_sse_or_json(response: httpx.Response) -> dict:
    """Streamable HTTP MCP servers answer with JSON or a one-event SSE stream."""
    if "text/event-stream" in response.headers.get("content-type", ""):
        for line in response.text.splitlines():
            if line.startswith("data:"):
                return json.loads(line[len("data:") :].strip())
        raise ValueError("empty event stream from Gateway")
    return response.json()


def tools_from_search_result(rpc: dict) -> list[dict]:
    """Pull the tool list out of a tools/call result for the search tool.

    The Gateway returns the matches in `structuredContent.tools`; older shapes put the same JSON as text.
    """
    result = rpc.get("result") or {}
    structured = result.get("structuredContent")
    if isinstance(structured, dict) and isinstance(structured.get("tools"), list):
        tools = structured["tools"]
    else:
        tools = []
        for block in result.get("content") or []:
            text = block.get("text") if isinstance(block, dict) else None
            if not text:
                continue
            try:
                parsed = json.loads(text)
            except ValueError:
                continue
            if isinstance(parsed, dict) and isinstance(parsed.get("tools"), list):
                tools.extend(parsed["tools"])
            elif isinstance(parsed, list):
                tools.extend(parsed)
    return [
        {
            "tool": t.get("name"),
            "description": t.get("description"),
            "inputs": (t.get("inputSchema") or {}).get("properties"),
        }
        for t in tools
        if isinstance(t, dict)
    ]


def search_gateway(settings: Settings, query: str) -> list[dict]:
    payload = {
        "jsonrpc": "2.0",
        "id": "find-paid-apis",
        "method": "tools/call",
        "params": {"name": SEARCH_TOOL, "arguments": {"query": query}},
    }
    with httpx.Client(timeout=30.0, auth=_SigV4(settings.region)) as client:
        response = client.post(
            settings.tool_gateway_url,
            json=payload,
            headers={
                "Accept": "application/json, text/event-stream",
                "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
            },
        )
        response.raise_for_status()
        return tools_from_search_result(_parse_sse_or_json(response))


def search_misa_catalog(settings: Settings, query: str) -> list[dict]:
    with httpx.Client(timeout=15.0) as client:
        response = client.get(f"{settings.misa_url}/v1/listings", params={"q": query})
        response.raise_for_status()
        listings = response.json()
    found = []
    for listing in listings if isinstance(listings, list) else []:
        for op in listing.get("operations") or []:
            found.append(
                {
                    "api": listing.get("name"),
                    "listing": f"{settings.misa_url}/x/{listing.get('slug')}",
                    "operation": op.get("operation_id"),
                    "call": f"{op.get('method', 'GET')} {listing.get('door_url', '').rstrip('/')}{op.get('path', '')}",
                    "summary": op.get("summary"),
                    "price_usd": op.get("price_usd"),
                }
            )
    return found


def make_find_paid_apis(settings: Settings):
    @tool
    def find_paid_apis(query: str) -> dict:
        """Search for paid data APIs that can answer part of the user's question.

        Describe the data you need in plain words, for example "upcoming earnings dates and consensus
        estimates for software companies". Returns matching API operations with what they do, their
        price per call and the URL to call. Calling one costs money, so only call what you need.

        Args:
            query: Plain-language description of the data you need.
        """
        errors: list[str] = []
        if settings.tool_gateway_url:
            try:
                tools = search_gateway(settings, query)
                if tools:
                    return {"source": "AgentCore Gateway tool search", "results": tools}
            except (httpx.HTTPError, ValueError) as exc:
                errors.append(f"gateway search failed: {exc}")
        if settings.misa_url:
            try:
                return {"source": "Misa catalog", "results": search_misa_catalog(settings, query)}
            except (httpx.HTTPError, ValueError) as exc:
                errors.append(f"catalog search failed: {exc}")
        return {"results": [], "errors": errors or ["no discovery source configured"]}

    return find_paid_apis


def make_verify_receipt(settings: Settings):
    @tool
    def verify_receipt(listing_url: str, receipt_id: str) -> dict:
        """Look up Misa's receipt for a paid call: whether the answer passed its checks, whether you were
        charged, and how much. Free to call.

        Args:
            listing_url: The API's listing URL, for example https://<misa>/x/<slug>.
            receipt_id: The X-Misa-Receipt header value from the paid response.
        """
        listing_url = listing_url.rstrip("/")
        if settings.misa_url and not listing_url.startswith(f"{settings.misa_url}/x/"):
            return {"error": f"receipts are only looked up on {settings.misa_url}"}
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.get(f"{listing_url}/receipts/{receipt_id}", headers={"Accept": "application/json"})
                response.raise_for_status()
                return {"receipt_url": str(response.url), "receipt": response.json()}
        except (httpx.HTTPError, ValueError) as exc:
            return {"error": f"could not read receipt: {exc}"}

    return verify_receipt


def describe_sources(settings: Settings) -> Optional[str]:
    sources = []
    if settings.tool_gateway_url:
        sources.append("AgentCore Gateway")
    if settings.misa_url:
        sources.append("Misa catalog")
    return " + ".join(sources) or None
