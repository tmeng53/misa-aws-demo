"""Configuration read from the environment, so the same code runs locally and on AgentCore Runtime."""

import os
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

# Base Sepolia, the testnet every piece of the demo uses (see contract.md, "Network and money").
BASE_SEPOLIA = "eip155:84532"
USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
USDC_DECIMALS = 6


def _env(name: str) -> Optional[str]:
    value = os.environ.get(name, "").strip()
    return value or None


def _gateway_url_from_cli_env() -> Optional[str]:
    # `agentcore deploy` injects AGENTCORE_GATEWAY_<NAME>_URL for each project Gateway.
    for key, value in os.environ.items():
        if key.startswith("AGENTCORE_GATEWAY_") and key.endswith("_URL") and value.strip():
            return value.strip()
    return None


def _payment_manager_arn_from_cli_env() -> Optional[str]:
    # `agentcore deploy` injects AGENTCORE_PAYMENT_<NAME>_MANAGER_ARN for each payment manager.
    for key, value in os.environ.items():
        if key.startswith("AGENTCORE_PAYMENT_") and key.endswith("_MANAGER_ARN") and value.strip():
            return value.strip()
    return None


@dataclass(frozen=True)
class Settings:
    region: str
    model_id: str
    # AgentCore Gateway MCP endpoint with semantic tool search (discovery, optional).
    tool_gateway_url: Optional[str]
    # Misa's public catalog (discovery fallback, and the only host the agent will pay).
    misa_url: Optional[str]
    payment_manager_arn: Optional[str]
    payment_user_id: str
    # Most the agent will pay for a single call, whatever the session budget allows.
    max_price_per_call_usd: Decimal

    @staticmethod
    def from_env() -> "Settings":
        region = _env("AWS_REGION") or _env("AWS_DEFAULT_REGION") or "us-west-2"
        return Settings(
            region=region,
            model_id=_env("MODEL_ID") or "global.anthropic.claude-sonnet-5-5",
            tool_gateway_url=_env("TOOL_GATEWAY_URL") or _gateway_url_from_cli_env(),
            misa_url=(_env("MISA_GATEWAY_URL") or "").rstrip("/") or None,
            payment_manager_arn=_env("PAYMENT_MANAGER_ARN") or _payment_manager_arn_from_cli_env(),
            payment_user_id=_env("PAYMENT_USER_ID") or "demo-buyer",
            max_price_per_call_usd=Decimal(_env("MAX_PRICE_PER_CALL_USD") or "0.05"),
        )
