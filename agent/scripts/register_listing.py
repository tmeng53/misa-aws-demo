"""List a Misa door in the agent's AgentCore Gateway, so semantic tool search can find it.

Fetches the door's OpenAPI (GET {MISA_GATEWAY_URL}/x/{slug}/openapi.json), checks it against what a
Gateway OpenAPI target accepts, saves it under listings/, and adds it as a Gateway target. Then run
`agentcore deploy`.

    MISA_GATEWAY_URL=https://... python scripts/register_listing.py northwind-fundamentals
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
GATEWAY = "MisaDiscovery"
CREDENTIAL = "MisaBuyerId"
UNSUPPORTED = ("oneOf", "anyOf", "allOf")
METHODS = ("get", "post", "put", "patch", "delete", "head", "options")


def problems(spec: dict) -> list[str]:
    """What AgentCore Gateway would reject (docs: gateway-schema-openapi.html)."""
    found = []
    if not str(spec.get("openapi", "")).startswith(("3.0", "3.1")):
        found.append("needs OpenAPI 3.0 or 3.1")
    servers = spec.get("servers") or []
    if not servers or not str(servers[0].get("url", "")).startswith("https://"):
        found.append("servers[0].url must be a public https URL")
    if (spec.get("components") or {}).get("securitySchemes") or spec.get("security"):
        found.append("remove securitySchemes/security (Gateway handles outbound auth)")
    text = json.dumps(spec)
    for keyword in UNSUPPORTED:
        if f'"{keyword}"' in text:
            found.append(f"{keyword} is not supported")
    for path, item in (spec.get("paths") or {}).items():
        for method in METHODS:
            op = item.get(method)
            if not isinstance(op, dict):
                continue
            op_id = op.get("operationId")
            if not op_id or not re.fullmatch(r"[A-Za-z0-9_]{1,40}", op_id):
                found.append(f"{method.upper()} {path}: operationId must be 1-40 letters, digits or _")
            if "http" not in (op.get("description") or ""):
                found.append(f"{method.upper()} {path}: description should include the full door URL")
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("slug")
    parser.add_argument("--misa-url", default=os.environ.get("MISA_GATEWAY_URL", "").rstrip("/"))
    parser.add_argument("--force", action="store_true", help="add the target even if the spec has warnings")
    args = parser.parse_args()
    if not args.misa_url:
        print("set MISA_GATEWAY_URL or pass --misa-url", file=sys.stderr)
        return 2

    url = f"{args.misa_url}/x/{args.slug}/openapi.json"
    with urllib.request.urlopen(url, timeout=20) as response:
        spec = json.load(response)
    issues = problems(spec)
    for issue in issues:
        print(f"  ! {issue}")
    if issues and not args.force:
        print("not registered; fix the door OpenAPI or pass --force", file=sys.stderr)
        return 1

    target = re.sub(r"[^A-Za-z0-9]", "", args.slug.title())[:40] or "MisaListing"
    out = PROJECT / "listings" / f"{args.slug}.openapi.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(spec, indent=2) + "\n")
    config = {
        "name": target,
        "targetType": "openApiSchema",
        "schemaSource": {"inline": {"path": str(out.relative_to(PROJECT))}},
        # Gateway requires outbound auth for OpenAPI targets. The door is paid per call, so this key only
        # tells Misa which buyer gateway is calling; it grants nothing.
        "outboundAuth": {"type": "API_KEY", "credentialName": CREDENTIAL},
    }
    subprocess.run(
        ["agentcore", "add", "gateway-target", "--gateway", GATEWAY, "--target-configuration", json.dumps(config)],
        cwd=PROJECT,
        check=True,
    )
    print(f"added {target} from {url}; now run: agentcore deploy")
    return 0


if __name__ == "__main__":
    sys.exit(main())
